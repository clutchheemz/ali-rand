// End-to-end test of the whole guest journey, on phone and desktop sizes.
//
//   npm run build && npm run test:e2e              tests the local build
//   npm run test:e2e -- https://your-site/         tests a deployed copy
//
// Uses the Chrome or Edge already installed on this machine. Writes screenshots to
// test-results/ and a summary to TEST-REPORT.md (test-results-live/ and TEST-REPORT-LIVE.md
// for a deployed copy). Exits 1 if any check fails.

import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright-core';
import { preview } from 'vite';
import { event } from '../src/config/event.ts';

const liveUrl = process.argv[2];
// a run against the live site keeps its own report and screenshots beside the local build's
const OUT = liveUrl ? 'test-results-live' : 'test-results';
const REPORT = liveUrl ? 'TEST-REPORT-LIVE.md' : 'TEST-REPORT.md';
// 4:00 PM in Baghdad (UTC+3), worked out by hand so the app's own time-zone maths is checked against it
const EVENT_START = Date.UTC(2026, 10, 26, 13, 0, 0);
// the misspelling of the venue that must never appear, assembled so this file does not contain it either
const MISSPELT = `البوعي${String.fromCharCode(0x0634)}ة`;

const server = liveUrl ? null : await preview({ preview: { port: 4179, strictPort: true } });
const BASE = liveUrl ? liveUrl.replace(/\/*$/, '/') : 'http://localhost:4179/';
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));

// clear the last run's screenshots, and nothing else: the artwork previews live in a sub-folder here
mkdirSync(OUT, { recursive: true });
for (const file of readdirSync(OUT)) if (file.endsWith('.png')) rmSync(join(OUT, file));

const results = [];
let scope = '';
async function check(name, fn) {
  try {
    results.push({ scope, name, ok: true, note: (await fn()) ?? '' });
  } catch (error) {
    results.push({ scope, name, ok: false, note: String(error.message ?? error).split('\n')[0] });
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Retries `attempt` until it stops throwing: a slow test machine makes this wait longer, it cannot make it fail. */
async function eventually(attempt, timeout = 6000) {
  const until = Date.now() + timeout;
  for (;;) {
    try {
      return await attempt();
    } catch (error) {
      if (Date.now() > until) throw error;
      await sleep(100);
    }
  }
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const phone = (name) => {
  const { defaultBrowserType: _, ...profile } = devices[name];
  return profile;
};

const PROFILES = {
  'iPhone 13': phone('iPhone 13'),
  'iPhone SE (small)': phone('iPhone SE'),
  'Pixel 7 (Android)': phone('Pixel 7'),
  'Galaxy S9+ (Android)': phone('Galaxy S9+'),
  'iPhone 13 landscape': phone('iPhone 13 landscape'),
  'Desktop 1440x900': { viewport: { width: 1440, height: 900 } },
};

/** Opens the invitation in a fresh browser context and returns helpers bound to that page. */
async function visit(profile, options = {}, prepare = async () => {}) {
  const context = await browser.newContext({
    ...profile,
    locale: 'ar-IQ',
    permissions: ['clipboard-read', 'clipboard-write'],
    ...options,
  });
  // a stand-in for the phone's share sheet, so the native-share button can be exercised
  await context.addInitScript(() => {
    navigator.share = async (data) => void (window.__shared = data);
  });
  // The page keeps its own record of what happens when, so a slow test machine cannot blur the timing.
  await context.addInitScript(() => {
    // every change of stage, and the moment the first screen is shown, by the page's clock
    window.__stages = [];
    const waiting = [];
    new MutationObserver((records) => {
      for (const { target, attributeName } of records) {
        if (!target.classList.contains('app')) continue;
        if (attributeName === 'data-ready') {
          if (target.dataset.ready === 'true') window.__readyAt ??= performance.now();
          continue;
        }
        const stage = target.dataset.stage;
        window.__stages.push([stage, performance.now()]);
        for (const hook of waiting.filter((h) => h.stage === stage)) {
          waiting.splice(waiting.indexOf(hook), 1);
          hook.run();
        }
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-stage', 'data-ready'] });
    // The moment the page next enters `stage`, `probe(at, term)` is run, once. Calling at(ms) puts every animation
    // on the page at that many milliseconds into the stage, so the probe reads from the browser itself what the
    // choreography looks like at any moment: exactly, and however slow the test machine is. The animations are
    // put back before a single frame is drawn, so the guest's view is untouched.
    window.__when = (stage, probe) =>
      new Promise((resolve, reject) => {
        const read = new Function(`return (${probe})`)();
        waiting.push({
          stage,
          run() {
            // asking also makes the browser set up the new stage's animations
            const animations = document.getAnimations().filter((a) => a.currentTime !== null);
            const was = animations.map((a) => a.currentTime);
            const at = (ms) => animations.forEach((a) => (a.currentTime = ms));
            const term = (selector, key) => new DOMMatrixReadOnly(getComputedStyle(document.querySelector(selector)).transform)[key];
            try {
              resolve(read(at, term));
            } catch (error) {
              reject(error);
            } finally {
              animations.forEach((a, i) => (a.currentTime = was[i]));
            }
          },
        });
      });
  });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()} ${r.url()}`));
  await prepare(page, context);
  await page.goto(BASE);
  await page.waitForSelector('.app[data-ready="true"]', { timeout: 30000 });

  const locate = (target) => (typeof target === 'string' ? page.locator(target).first() : target);
  const box = (target) => locate(target).boundingBox();
  /** A real tap (or click) at the centre of the element, wherever it is on screen. */
  const press = async (target) => {
    const b = await box(target);
    assert(b, `${target} is not on screen`);
    const [x, y] = [b.x + b.width / 2, b.y + b.height / 2];
    if (profile.hasTouch) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
  };
  const stage = (name, timeout = 9000) => page.waitForSelector(`.app[data-stage="${name}"]`, { state: 'attached', timeout });
  /** Milliseconds, by the page's own clock, from entering stage `a` to entering stage `b` (the latest such pair). */
  const between = (a, b) =>
    page.evaluate(([a, b]) => {
      const end = window.__stages.findLast(([name]) => name === b);
      const start = end && window.__stages.findLast(([name, at]) => name === a && at <= end[1]);
      return start ? Math.round(end[1] - start[1]) : null;
    }, [a, b]);
  /**
   * Has the page read its own animations the moment it next enters `stageName`: `probe(at, term)` runs in the
   * page, where at(ms) sets every animation to that moment of the stage. Call before the tap, await afterwards.
   */
  const when = (stageName, probe) => {
    const seen = Promise.race([
      page.evaluate(([stageName, probe]) => window.__when(stageName, probe), [stageName, String(probe)]),
      sleep(12000).then(() => Promise.reject(new Error(`the page never entered its "${stageName}" stage`))),
    ]);
    seen.catch(() => {}); // a failure is reported where the result is awaited, not as a stray rejection
    return seen;
  };
  /** Asserts the element is entirely within the visible screen. */
  const inside = async (target, slack = 2) => {
    const b = await box(target);
    const v = page.viewportSize();
    assert(b, `${target} has no box`);
    const fits = b.x >= -slack && b.y >= -slack && b.x + b.width <= v.width + slack && b.y + b.height <= v.height + slack;
    assert(fits, `${target} is clipped: ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)} on ${v.width}x${v.height}`);
    return b;
  };
  const shot = (name) => page.screenshot({ path: join(OUT, `${slug(scope)}--${name}.png`), scale: 'css' });
  const css = (selector, property) => page.$eval(selector, (el, p) => getComputedStyle(el)[p], property);
  /** The element's current transform as matrix terms: m11 = scale, m22 = cos(rotateX), m41 / m42 = translateX / Y. */
  const matrix = (selector) =>
    page.$eval(selector, (el) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return { m11: m.m11, m22: m.m22, m41: m.m41, m42: m.m42 };
    });
  return { context, page, problems, box, press, stage, between, when, inside, shot, css, matrix };
}

/** The complete journey: envelope, ribbon-tied card, invitation, every button, close, reopen, replay. */
async function journey(name, profile) {
  scope = name;
  const s = await visit(profile);
  const { page, press, stage, between, when, inside, shot, css, box, matrix } = s;
  const view = page.viewportSize();
  const isPhone = Boolean(profile.isMobile);
  const fullBleed = view.width <= 640; // wider screens show the invitation as a centred sheet

  await check('page fills the screen exactly, with no page scrollbars', async () => {
    const m = await page.evaluate(() => ({
      app: document.querySelector('.app').getBoundingClientRect().toJSON(),
      doc: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      win: [innerWidth, innerHeight],
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
    }));
    assert.deepEqual([m.app.x, m.app.y, m.app.width, m.app.height], [0, 0, ...m.win]);
    assert(m.doc[0] <= m.win[0] && m.doc[1] <= m.win[1], `document is larger than the screen: ${m.doc}`);
    assert.equal(m.lang, 'ar');
    assert.equal(m.dir, 'rtl');
    return `${view.width}x${view.height} viewport`;
  });

  await check('sealed envelope fills the screen: embossed flaps, title, wax seal, hint', async () => {
    const sheet = await inside('.stage');
    const env = await inside('.env-hit');
    const title = await inside('.scene__title');
    const hint = await inside('.env__hint');
    const seal = await inside('.seal__wax');
    await inside('.music');
    assert.equal(await page.locator('.scene__title').textContent(), event.text.envelopeTitle);
    assert.equal(await page.locator('.env__hint').textContent(), event.text.envelopeHint);
    assert(Math.abs(env.width - sheet.width) < 1 && Math.abs(env.height - view.height) < 1, 'envelope does not fill the stage');
    if (fullBleed) assert(sheet.x <= 1 && sheet.width >= view.width - 1, 'the envelope does not reach both edges of the screen');
    assert(sheet.height >= view.height - 1, 'the envelope does not fill the height');
    assert(Math.abs(seal.x + seal.width / 2 - view.width / 2) < 3, 'seal is not centred');
    assert(title.y + title.height <= seal.y, 'title overlaps the seal');
    assert(hint.y >= seal.y + seal.height, 'hint overlaps the seal');
    // every embossed picture the envelope uses has arrived and is drawn into the paper
    const art = await page.evaluate(async () => {
      const urls = ['.flap--left', '.flap--right', '.flap--bottom', '.lid__paper', '.seal__wax'].flatMap((selector) => {
        const style = getComputedStyle(document.querySelector(selector));
        return [...`${style.backgroundImage} ${style.maskImage || style.webkitMaskImage}`.matchAll(/url\("([^"]+\.(?:jpg|png)[^"]*|data:image\/(?:jpeg|png)[^"]*)"\)/g)].map((m) => m[1]);
      });
      const sizes = await Promise.all(urls.map((src) => new Promise((done) => {
        const img = new Image();
        img.onload = () => done(img.naturalWidth);
        img.onerror = () => done(0);
        img.src = src;
      })));
      return { count: urls.length, missing: sizes.filter((w) => !w).length, blend: getComputedStyle(document.querySelector('.flap--left')).backgroundBlendMode };
    });
    assert(art.count >= 8, `only ${art.count} embossed pictures on the envelope`);
    assert.equal(art.missing, 0, `${art.missing} embossed pictures failed to load`);
    assert(art.blend.includes('hard-light'), 'the embossing is not blended into the paper');
    await sleep(1000); // let the scene finish fading in before the picture
    await shot('1-envelope');
    return `${art.count} embossed pictures; seal ${Math.round(seal.width)}px`;
  });

  let tapped = 0;
  let opening; // what the seal, the lid and the envelope do during the opening, read from the page's own animations
  await check('tap the envelope (double tap): seal reacts, music starts, one opening only', async () => {
    opening = when('opening', (at, term) => {
      const seen = { seal: 1 };
      for (const ms of [40, 80, 120, 160, 200, 260]) {
        at(ms);
        seen.seal = Math.min(seen.seal, term('.seal__wax', 'm11')); // the smallest size the seal is pressed to
      }
      at(800);
      seen.lidAt800 = term('.lid', 'm22'); // the cosine of the lid's angle
      seen.pocketAt800 = term('.pocket', 'm42'); // how far down the envelope has moved, in px
      at(1600);
      seen.lidAt1600 = term('.lid', 'm22');
      at(2000);
      seen.pocketAt2000 = term('.pocket', 'm42');
      return seen;
    });
    tapped = Date.now();
    await press('.env-hit');
    await press('.env-hit').catch(() => {}); // an impatient second tap must change nothing
    const { seal } = await opening;
    assert.equal(await page.evaluate(() => window.__stages.filter(([name]) => name === 'opening').length), 1, 'the envelope did not open exactly once');
    assert(seal < 0.95, `seal did not press in (smallest scale ${seal})`);
    assert.equal(await page.$eval('audio', (a) => a.paused), false, 'music did not start with the first tap');
    return `seal pressed to ${Math.round(seal * 100)}%`;
  });

  await check('lid lifts in 3D on its hinge, then the envelope drops away', async () => {
    await sleep(Math.max(0, tapped + 800 - Date.now()));
    await shot('2-lid-lifting');
    await sleep(Math.max(0, tapped + 2000 - Date.now()));
    await shot('3-envelope-leaving');
    const seen = await opening;
    const degrees = (cos) => Math.round((Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI);
    assert(seen.lidAt800 < 0.92, `lid has not lifted after 0.8 s (${degrees(seen.lidAt800)} degrees)`);
    assert(seen.lidAt1600 < 0.2, `the lid never swung right up (${degrees(seen.lidAt1600)} degrees)`);
    assert(seen.pocketAt800 < 5, `the envelope left before its lid had lifted (${Math.round(seen.pocketAt800)}px down after 0.8 s)`);
    assert(seen.pocketAt2000 > 40, `envelope has not started to drop away after 2.0 s (${Math.round(seen.pocketAt2000)}px)`);
    return `lid at ${degrees(seen.lidAt800)} degrees after 0.8 s, ${degrees(seen.lidAt1600)} degrees once open; envelope ${Math.round(seen.pocketAt2000)}px down after 2.0 s`;
  });

  await check('card lies there tied with its ribbon and bow, and takes focus', async () => {
    await stage('card');
    // by the page's own clock; the sequence is 3000 ms, and the upper bound leaves room for a machine that stalls
    const took = await between('opening', 'card');
    assert(took > 2600 && took < 7000, `opening took ${took} ms, expected about 3000`);
    assert.equal(await css('.scene', 'visibility'), 'hidden', 'envelope is still on screen');
    const bow = await inside('.wrap__bow', 4);
    const [left, right] = [await box('.wrap__half--l'), await box('.wrap__half--r')];
    assert(left.x + left.width >= right.x, 'the two lengths of ribbon do not meet');
    assert(Math.abs(bow.x + bow.width / 2 - view.width / 2) < 3, 'bow is not centred');
    await inside('.wrap__hint');
    assert.equal(await page.locator('.wrap__hint').textContent(), event.text.cardHint);
    assert(Number(await css('.wrap__hint', 'opacity')) > 0, 'card hint is not showing');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'card__hit');
    const hidden = await page.$$eval('.reveal', (els) => els.filter((el) => getComputedStyle(el).opacity !== '0').length);
    assert.equal(hidden, 0, 'the invitation text is showing before the ribbon is off');
    await sleep(500);
    await shot('4-card');
    return `opening ${took} ms; bow ${Math.round(bow.width)}px wide`;
  });

  if (!isPhone) {
    await check('bow leans toward the cursor and gives when pressed', async () => {
      const b = await box('.stage');
      await page.mouse.move(b.x + b.width * 0.85, b.y + b.height * 0.2);
      const tilt = await eventually(async () => {
        const lean = await page.$eval('.wrap', (el) => [el.style.getPropertyValue('--tx'), el.style.getPropertyValue('--ty')].map(Number));
        assert(lean[0] > 0.5 && lean[1] < -0.4, `no lean: ${lean}`);
        return lean;
      });
      await eventually(async () => assert((await matrix('.wrap__bow')).m41 > 0.5, 'bow has not moved'));
      await page.mouse.down();
      await eventually(async () => assert.equal(await page.$eval('.wrap', (el) => el.style.getPropertyValue('--press')), '0.96', 'bow does not give'));
      await page.mouse.up(); // releasing on the card is the click that opens it, so this check runs just before the open check
      await stage('open');
      await press('.sheet__close');
      await stage('card');
      return `lean ${tilt.join(', ')}`;
    });
  }

  if (name === 'iPhone 13') {
    await check('browser toolbars collapse and expand: layout follows', async () => {
      for (const height of [745, 664]) {
        await page.setViewportSize({ width: 390, height });
        await sleep(200);
        await eventually(() => inside('.wrap__bow', 4));
        await eventually(() => inside('.wrap__hint'));
      }
    });
    await check('rotate to landscape and back at the card', async () => {
      await page.setViewportSize({ width: 750, height: 342 });
      await sleep(250);
      await eventually(() => inside('.wrap__bow', 4));
      await shot('4b-card-rotated');
      await page.setViewportSize({ width: 390, height: 664 });
      await sleep(250);
      await eventually(() => inside('.wrap__bow', 4));
      await eventually(() => inside('.wrap__hint'));
    });
  }

  await check('tap the bow (double tap): it is untied part by part, then the ribbon slides off both sides', async () => {
    // the bow is five parts of one picture; pulled, the tails stretch while the loops run into the knot.
    // What each part is doing 0.48 s and 1.5 s into the untying is read from the page's own animations.
    const untied = () => page.evaluate(() => window.__stages.filter(([name]) => name === 'unfolding').length);
    const before = await untied();
    const untying = when('unfolding', (at, term) => {
      const opacity = (part) => Number(getComputedStyle(document.querySelector(`.bow__part--${part}`)).opacity);
      at(480);
      const early = { loop: term('.bow__part--loop-l', 'm11'), knot: opacity('knot') };
      at(1500);
      const parts = Object.fromEntries(['loop-l', 'loop-r', 'tail-l', 'tail-r', 'knot'].map((part) => [part, opacity(part)]));
      return { early, late: { parts, left: term('.wrap__half--l', 'm41'), right: term('.wrap__half--r', 'm41') } };
    });
    tapped = Date.now();
    await press('.card__hit');
    await press('.card__hit').catch(() => {});
    await sleep(Math.max(0, tapped + 480 - Date.now()));
    await shot('5-bow-untying');
    await sleep(Math.max(0, tapped + 1500 - Date.now()));
    await shot('5b-ribbon-leaving');
    const { early, late } = await untying;
    assert.equal(await untied(), before + 1, 'the bow was not untied exactly once');
    assert(early.loop < 0.9, `the loops have not started to run into the knot after 0.48 s (width ${early.loop.toFixed(2)})`);
    assert(early.knot > 0.9, 'the knot has gone before the loops');
    for (const [part, opacity] of Object.entries(late.parts)) assert(opacity < 0.2, `the bow's ${part} is still there after 1.5 s`);
    assert(late.left < -20 && late.right > 20, `ribbon has not started to slide off after 1.5 s (${Math.round(late.left)}, ${Math.round(late.right)})`);
    await stage('open');
    assert.equal(await css('.wrap', 'visibility'), 'hidden', 'ribbon is still on the card');
    return `loops at ${Math.round(early.loop * 100)}% width after 0.48 s; ribbon ${Math.round(-late.left)}px and ${Math.round(late.right)}px off after 1.5 s`;
  });

  await check('invitation fills the screen and its text arrives', async () => {
    await stage('open');
    const took = await between('unfolding', 'open'); // by the page's own clock; the sequence is 3000 ms
    assert(took > 2700 && took < 7000, `unfolding took ${took} ms, expected about 3000`);
    const sheet = await box('.stage');
    const hero = await box('.hero');
    assert(Math.abs(hero.x - sheet.x) < 1 && Math.abs(hero.width - sheet.width) < 1, 'card does not span the stage');
    assert(hero.y <= 1 && hero.height >= view.height - 1, 'card does not fill the height');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'sheet__scroll', 'focus did not move into the invitation');
    await sleep(900);
    await eventually(async () => {
      const hidden = await page.$$eval('.reveal', (els) => els.filter((el) => getComputedStyle(el).opacity !== '1').length);
      assert.equal(hidden, 0, `${hidden} lines never appeared`);
    });
    const frame = await page.$eval('.hero', (el) => getComputedStyle(el).backgroundImage.match(/url\(/g).length);
    assert(frame >= 8, `the card has only ${frame} background pictures (grain, four corners, three frame parts)`);
    await shot('6-invitation-top');
    return `unfolding ${took} ms`;
  });

  await check('Arabic text: exact wording, right-to-left, real fonts, readable sizes', async () => {
    const t = event.text;
    const text = (selector) => page.locator(selector).first().textContent();
    assert.equal(await text('.hero__bismillah'), t.bismillah);
    assert.equal(await text('.hero__verse'), t.verse, 'the verse differs from the supplied text');
    assert.equal(await text('.hero__lead'), t.intro.join(''));
    assert.equal(await text('.hero__names'), event.groom.ar + event.bride.ar);
    assert.equal((await page.locator('.day__line, .day__date').allTextContents()).join('|'), [t.dayLine, t.dateLine, t.timeLine].join('|'));
    assert.equal(await text('.location__name'), event.venue.name);
    assert.equal(await text('.location__area'), event.venue.area);
    assert.equal(await text('.closing__line'), t.closing);
    const all = await page.evaluate(() => document.body.innerText);
    assert(all.includes('البوعيثة') && !all.includes(MISSPELT), 'the venue is misspelt');
    // nothing a guest can read, the share box included, carries a stray programming character
    const stray = await page.$eval('.app', (el) => [...el.textContent.matchAll(/.{0,12}[`\\${}<>|_=;#@^~[\]].{0,12}/gs)].map((m) => m[0]));
    assert.deepEqual(stray, [], `stray characters in the text: ${stray.join(' … ')}`);
    assert.equal(await css('.sheet__scroll', 'direction'), 'rtl');
    const fonts = await page.evaluate(() =>
      ['1em Amiri', '700 1em Amiri', '1em "Noto Naskh Arabic Variable"', '500 1em "Cormorant Garamond"'].map((f) => document.fonts.check(f, 'علي A 2')),
    );
    assert(!fonts.includes(false), `web fonts not loaded: ${fonts}`);
    const sizes = {};
    for (const sel of ['.hero__verse', '.hero__lead', '.day__line', '.location__area', '.countdown__label', '.btn']) sizes[sel] = parseFloat(await css(sel, 'fontSize'));
    assert(sizes['.hero__verse'] >= 14.5 && sizes['.hero__lead'] >= 14.5 && sizes['.day__line'] >= 15 && sizes['.location__area'] >= 15 && sizes['.btn'] >= 14, `text too small: ${JSON.stringify(sizes)}`);
    assert(sizes['.countdown__label'] >= 12);
    return `verse ${sizes['.hero__verse']}px, body ${sizes['.hero__lead']}px`;
  });

  await check('invitation scrolls top to bottom with nothing cut off sideways', async () => {
    const m = await page.$eval('.sheet__scroll', (el) => {
      const frame = el.getBoundingClientRect();
      const wide = [...el.querySelectorAll('*')].filter((child) => {
        // shapes inside a drawing are clipped by the drawing's own frame, so only the frame is measured
        if (child.closest('dialog') || child.ownerSVGElement) return false;
        const r = child.getBoundingClientRect();
        return r.width > 0 && (r.left < frame.left - 1 || r.right > frame.right + 1);
      }).map((child) => child.className || child.tagName);
      el.scrollTo(0, el.scrollHeight);
      return { wide, overflowX: el.scrollWidth - el.clientWidth, scrollable: el.scrollHeight - el.clientHeight, top: el.scrollTop };
    });
    assert.deepEqual(m.wide, [], `elements stick out sideways: ${m.wide}`);
    assert(m.overflowX <= 0, 'the sheet scrolls sideways');
    assert(m.scrollable > 0, 'the invitation does not scroll');
    await sleep(1200); // the last sections rise into place
    const atBottom = await page.$eval('.sheet__scroll', (el) => el.scrollHeight - el.clientHeight - el.scrollTop);
    assert(Math.abs(atBottom) <= 2, 'could not reach the bottom');
    await inside('.closing__line');
    await eventually(async () => assert.equal(await css('.closing__card', 'opacity'), '1', 'the closing card never rose into view'));
    await shot('7-invitation-bottom');
    return `scrolls ${m.scrollable}px`;
  });

  await check('music: playing, loops, toggle mutes and unmutes', async () => {
    const before = await page.$eval('audio', (a) => ({ paused: a.paused, time: a.currentTime, loop: a.loop, duration: a.duration }));
    assert.equal(before.paused, false);
    assert.equal(before.loop, true);
    assert(before.duration > 30, `suspicious duration ${before.duration}`);
    await sleep(600);
    assert((await page.$eval('audio', (a) => a.currentTime)) > before.time, 'playback is not advancing');
    assert.equal(await page.getAttribute('.music', 'aria-pressed'), 'true');
    await press('.music');
    await eventually(async () => {
      assert.equal(await page.$eval('audio', (a) => a.paused), true, 'toggle did not mute');
      assert.equal(await page.getAttribute('.music', 'aria-pressed'), 'false');
    });
    await press('.music');
    await eventually(async () => assert.equal(await page.$eval('audio', (a) => a.paused), false, 'toggle did not unmute'));
    return `${before.duration.toFixed(0)} s loop`;
  });

  await check('countdown matches the clock and ticks', async () => {
    const read = () =>
      page.evaluate((start) => {
        const [d, h, m, sec] = [...document.querySelectorAll('.countdown__value')].map((el) => Number(el.textContent));
        return { shown: d * 86400 + h * 3600 + m * 60 + sec, expected: Math.max(0, Math.ceil((start - Date.now()) / 1000)) };
      }, EVENT_START);
    const first = await read();
    assert(Math.abs(first.shown - first.expected) <= 1, `shows ${first.shown}s, should be ${first.expected}s`);
    assert.deepEqual(await page.$$eval('.countdown__label', (els) => els.map((el) => el.textContent)), ['يوم', 'ساعة', 'دقيقة', 'ثانية']);
    await sleep(2100);
    const later = await read();
    assert(Math.abs(later.shown - later.expected) <= 1, `two seconds on it shows ${later.shown}s, should be ${later.expected}s`);
    if (first.shown > 3) assert(later.shown < first.shown, 'countdown is not ticking');
    return `${Math.floor(first.shown / 86400)}d ${Math.floor((first.shown % 86400) / 3600)}h left`;
  });

  await check('map button opens the exact Google Maps link in a new tab', async () => {
    const link = page.locator('.location a');
    assert.equal(await link.textContent(), event.text.mapButton);
    assert.equal(await link.getAttribute('href'), 'https://maps.app.goo.gl/MHSG1Es7NzxsDXX79?g_st=ic');
    assert.equal(await link.getAttribute('target'), '_blank');
    assert((await link.getAttribute('rel')).includes('noopener'));
    await link.scrollIntoViewIfNeeded();
    await inside(link);
  });

  await check('share: native share, WhatsApp and copy link all carry the invitation address', async () => {
    const url = new URL('.', page.url()).href;
    const button = page.getByRole('button', { name: event.text.shareButton });
    await button.scrollIntoViewIfNeeded();
    await press(button);
    await page.waitForSelector('dialog[open]');
    assert.equal(await page.locator('dialog[open] .dialog__title').textContent(), event.text.shareButton, 'the share box has the wrong title');
    await sleep(450);
    await inside('dialog[open] .dialog__panel');
    await shot('8-share-choices');
    await press(page.locator('dialog[open] button').nth(0));
    await eventually(async () => assert.deepEqual(await page.evaluate(() => window.__shared), { title: event.share.title, text: event.share.description, url }));
    const whatsapp = new URL(await page.locator('dialog[open] a').getAttribute('href'));
    assert.equal(whatsapp.origin + whatsapp.pathname, 'https://wa.me/');
    assert.equal(whatsapp.searchParams.get('text'), `${event.share.title}\n${event.share.description}\n${url}`);
    await press(page.locator('dialog[open] button').nth(1));
    await eventually(async () => {
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), url);
      assert((await page.locator('dialog[open] button').nth(1).textContent()).startsWith('تم نسخ الرابط'));
    });
    if (profile.hasTouch) await page.touchscreen.tap(8, 8);
    else await page.mouse.click(8, 8);
    await eventually(async () => assert.equal(await page.locator('dialog[open]').count(), 0, 'tapping outside did not close the dialog'));
    await press(button);
    await page.waitForSelector('dialog[open]');
    await page.keyboard.press('Escape');
    await eventually(async () => assert.equal(await page.locator('dialog[open]').count(), 0, 'Escape did not close the dialog'));
    await sleep(150);
    assert.equal(await page.getAttribute('.app', 'data-stage'), 'open', 'Escape closed the card as well');
  });

  await check('close the card (the ribbon ties itself again), reopen it, then replay from the sealed envelope', async () => {
    await press('.sheet__close');
    await stage('card');
    const closing = await between('closing', 'card'); // by the page's own clock; the sequence is 1500 ms
    assert(closing > 1200 && closing < 5000, `closing took ${closing} ms, expected about 1500`);
    await sleep(400);
    await eventually(async () => {
      await inside('.wrap__bow', 4);
      for (const part of ['loop-l', 'loop-r', 'tail-l', 'tail-r', 'knot']) assert.equal(await css(`.bow__part--${part}`, 'opacity'), '1', `the bow's ${part} did not come back`);
    });
    assert.equal(await page.$eval('.sheet__scroll', (el) => el.scrollTop), 0, 'the card did not return to its top');
    assert.equal(await page.$eval('.sheet', (el) => el.inert), true, 'the invitation can still be reached behind the ribbon');
    await press('.card__hit');
    await stage('open');
    const replay = page.getByRole('button', { name: 'إعادة العرض من البداية' });
    await replay.scrollIntoViewIfNeeded();
    await press(replay);
    await stage('sealed');
    await sleep(700);
    await eventually(async () => {
      await inside('.env-hit');
      assert.equal(await css('.scene', 'visibility'), 'visible', 'the envelope did not come back');
      assert((await matrix('.lid')).m22 > 0.99, 'the lid is not closed again');
      await inside('.seal__wax');
    });
    await press('.env-hit');
    await stage('card');
  });

  await check('no console errors, script errors or failed requests', async () => {
    assert.deepEqual(s.problems, []);
  });

  await s.context.close();
}

// ---------------------------------------------------------------------------------------------

for (const [name, profile] of Object.entries(PROFILES)) await journey(name, profile);

scope = 'Keyboard (desktop)';
{
  const s = await visit(PROFILES['Desktop 1440x900']);
  await check('Tab, Enter and Space open the envelope and the card; Escape closes it', async () => {
    await s.page.keyboard.press('Tab');
    assert.equal(await s.page.evaluate(() => document.activeElement.className), 'env-hit');
    assert((await s.css('.env-hit', 'outlineStyle')) !== 'none', 'no visible focus ring on the envelope');
    await s.page.keyboard.press('Enter');
    await s.stage('card');
    assert.equal(await s.page.evaluate(() => document.activeElement.className), 'card__hit');
    await s.page.keyboard.press('Space');
    await s.stage('open');
    await s.page.keyboard.press('Escape');
    await s.stage('card');
    assert.equal(await s.page.evaluate(() => document.activeElement.className), 'card__hit');
  });
  await s.context.close();
}

scope = 'Reduced motion';
{
  const s = await visit(PROFILES['iPhone 13'], { reducedMotion: 'reduce' });
  await check('journey completes with cross-fades only, nothing left animating', async () => {
    await s.press('.env-hit');
    await s.stage('card');
    const opening = await s.between('opening', 'card'); // by the page's own clock
    await sleep(500);
    await s.inside('.wrap__bow', 4);
    assert.equal(await s.css('.scene', 'visibility'), 'hidden');
    await s.press('.card__hit');
    await s.stage('open');
    const unfolding = await s.between('unfolding', 'open');
    assert(opening < 2500 && unfolding < 2500, `the cross-fades are not short: ${opening} ms and ${unfolding} ms`);
    await sleep(600);
    await eventually(async () => {
      const running = await s.page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
      assert.equal(running, 0, `${running} animations still running`);
      assert.equal(await s.css('.hero__verse', 'opacity'), '1');
    });
    assert.equal(await s.page.locator('.hero__verse').textContent(), event.text.verse);
    await s.shot('invitation');
    await s.press('.sheet__close');
    await s.stage('card');
    assert.deepEqual(s.problems, []);
    return `opening ${opening} ms, unfolding ${unfolding} ms`;
  });
  await s.context.close();
}

scope = 'Slow mobile network (500 kbit/s, 400 ms latency)';
{
  const bytes = { early: 0, audio: 0 };
  const s = await visit(PROFILES['Pixel 7 (Android)'], {}, async (page, context) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (500 * 1024) / 8, uploadThroughput: (500 * 1024) / 8 });
    cdp.on('Network.loadingFinished', (e) => (bytes.early += e.encodedDataLength));
    page.on('request', (r) => r.url().endsWith('.mp3') && (bytes.audio += 1));
  });
  await check('envelope is on screen quickly; nothing heavy loads before the first tap', async () => {
    // counted by the page's own clock from the moment the address was opened
    const ready = await s.page.evaluate(() => Math.round(window.__readyAt));
    assert(ready < 15000, `took ${ready} ms to show the envelope`);
    assert.equal(bytes.audio, 0, 'music was requested before any interaction');
    await s.inside('.env-hit');
    return `ready in ${(ready / 1000).toFixed(1)} s, ${(bytes.early / 1024).toFixed(0)} KB transferred`;
  });
  await check('journey does not wait for the music; music joins when it has buffered', async () => {
    await s.press('.env-hit');
    await sleep(200);
    const state = await s.page.getAttribute('.music', 'data-state');
    assert(['loading', 'on'].includes(state), `music state is ${state}`);
    await s.stage('card');
    await s.press('.card__hit');
    await s.stage('open');
    await s.page.waitForSelector('.music[data-state="on"]', { timeout: 30000 });
    assert.deepEqual(s.problems, []);
    return `music was "${state}" 0.2 s after the tap`;
  });
  await s.context.close();
}

scope = 'Music file unavailable';
{
  const s = await visit(PROFILES['iPhone 13'], {}, (page) => page.route('**/*.mp3', (route) => route.abort()));
  await check('invitation still works; the toggle shows music is unavailable', async () => {
    await s.press('.env-hit');
    await s.stage('card');
    await s.page.waitForSelector('.music[data-state="error"]', { timeout: 5000 });
    assert.equal(await s.page.locator('.music').isDisabled(), true);
    await s.press('.card__hit');
    await s.stage('open');
    assert.deepEqual(s.problems.filter((p) => p.startsWith('page error')), []);
  });
  await s.context.close();
}

scope = 'Screens whose pixels do not line up with the layout (most Android phones)';
{
  // Paper grain and room light are switched off, so flat paper is one exact colour and a stray line shows.
  const s = await visit(PROFILES['Pixel 7 (Android)'], {}, (page) =>
    page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent =
          ':root{--grain:none!important;--mottle:none!important}.stage::after{display:none!important}' +
          '.reveal,.rise{opacity:1!important;transform:none!important;animation:none!important}';
        document.head.appendChild(style);
      });
    }),
  );
  await check('no hairline box round the embossed ornaments', async () => {
    await s.press('.env-hit');
    await s.stage('card');
    await s.press('.card__hit');
    await s.stage('open');
    await sleep(600);
    const dpr = PROFILES['Pixel 7 (Android)'].deviceScaleFactor;
    assert(dpr % 1 !== 0, 'this check needs a fractional pixel ratio');
    let worst = 0;
    let count = 0;
    for (const ornament of await s.page.locator('.flourish, .medallion').all()) {
      await ornament.scrollIntoViewIfNeeded();
      await sleep(250);
      const data = (await s.page.screenshot({ type: 'png' })).toString('base64'); // device pixels
      // the largest departure from the paper colour within 5 device pixels of each edge of the ornament's box
      const off = await ornament.evaluate(async (el, { data, dpr }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const paper = getComputedStyle(el).backgroundColor.match(/\d+/g).slice(0, 3).map(Number);
        const r = el.getBoundingClientRect();
        const [L, T, R, B] = [r.left, r.top, r.right, r.bottom].map((v) => v * dpr);
        const k = 5;
        let max = 0;
        for (const [x0, y0, x1, y1] of [[L - k, T - k, L + k, B + k], [R - k, T - k, R + k, B + k], [L - k, T - k, R + k, T + k], [L - k, B - k, R + k, B + k]]) {
          for (let y = Math.max(0, Math.floor(y0)); y < Math.min(canvas.height, Math.ceil(y1)); y++) {
            for (let x = Math.max(0, Math.floor(x0)); x < Math.min(canvas.width, Math.ceil(x1)); x++) {
              const i = (y * canvas.width + x) * 4;
              max = Math.max(max, Math.abs(px[i] - paper[0]), Math.abs(px[i + 1] - paper[1]), Math.abs(px[i + 2] - paper[2]));
            }
          }
        }
        return max;
      }, { data, dpr });
      worst = Math.max(worst, off);
      count++;
    }
    assert(count >= 4, `only ${count} ornaments found`);
    assert(worst <= 3, `a line ${worst} levels off the paper colour runs along an ornament's edge`);
    return `${count} ornaments at pixel ratio ${dpr}; largest departure from the paper colour at their edges: ${worst} of 255`;
  });
  await s.context.close();
}

scope = 'Countdown at the event start';
{
  // the page's clock is ours to drive; the phone is set to New York to prove the zone maths
  const s = await visit(PROFILES['iPhone 13'], { timezoneId: 'America/New_York' }, (page) => page.clock.install({ time: new Date(EVENT_START - 3 * 86400000) }));
  const shown = () => s.page.$$eval('.countdown__value', (els) => els.map((el) => el.textContent).join(':'));
  await check('reaches zero exactly at 4:00 PM Baghdad time, whatever the phone time zone', async () => {
    await s.page.clock.pauseAt(new Date(EVENT_START - 86400000 - 3661000 - 500));
    await s.page.clock.runFor(300);
    assert.equal(await shown(), '01:01:01:02', 'a day, an hour, a minute and a second (and a bit) before the start');
    await s.page.clock.pauseAt(new Date(EVENT_START - 2500));
    await s.page.clock.runFor(300); // 2.2 s to go
    assert.equal(await shown(), '00:00:00:03');
    await s.page.clock.runFor(1500); // 0.7 s to go
    assert.equal(await shown(), '00:00:00:01');
    await s.page.clock.runFor(1000); // 0.3 s past the start
    assert.equal(await shown(), '00:00:00:00');
    await s.page.clock.fastForward(3600 * 1000);
    await s.page.clock.runFor(300);
    assert.equal(await shown(), '00:00:00:00', 'countdown went negative after the start');
  });
  await s.context.close();
}

scope = 'Link preview (WhatsApp, Open Graph, Twitter)';
{
  const html = await (await fetch(BASE)).text();
  const meta = (key) => html.match(new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]+content="([^"]*)"`))?.[1];
  await check('title, description and card type', async () => {
    assert.equal(html.match(/<title>([^<]*)<\/title>/)?.[1], event.share.title);
    for (const key of ['og:title', 'twitter:title']) assert.equal(meta(key), event.share.title, key);
    for (const key of ['description', 'og:description', 'twitter:description']) assert.equal(meta(key), event.share.description, key);
    assert.equal(meta('twitter:card'), 'summary_large_image');
    assert.equal(meta('og:type'), 'website');
    assert(!html.includes('__'), 'an unfilled __PLACEHOLDER__ is left in the page');
  });
  await check('preview image: 1200x630 JPEG, small enough for WhatsApp', async () => {
    assert.equal(meta('og:image'), meta('twitter:image'));
    const response = await fetch(new URL(meta('og:image'), BASE));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length < 300 * 1024, `image is ${(bytes.length / 1024).toFixed(0)} KB`);
    const sof = bytes.indexOf(Buffer.from([0xff, 0xc0])); // baseline JPEG frame header holds the size
    assert.deepEqual([bytes.readUInt16BE(sof + 7), bytes.readUInt16BE(sof + 5)], [1200, 630]);
    assert.deepEqual([meta('og:image:width'), meta('og:image:height')], ['1200', '630']);
    return `${(bytes.length / 1024).toFixed(0)} KB`;
  });
  await check('preview image and page address are absolute https URLs', async () => {
    if (!liveUrl) return 'skipped for the local build: set SITE_URL when building for the real address';
    assert(meta('og:image').startsWith('https://'), meta('og:image'));
    assert.equal(meta('og:url'), BASE);
    assert.equal(new URL(meta('og:image')).origin, new URL(BASE).origin);
  });
  await check('favicon and home-screen icon are served', async () => {
    const icons = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    assert(icons.length >= 3, `only ${icons.length} icon links`);
    for (const href of icons) assert.equal((await fetch(new URL(href, BASE))).status, 200, href);
    return icons.join(', ');
  });
}

if (!liveUrl) {
  scope = 'Source and build';
  const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
  const textFiles = [...files('src'), ...files('dist'), 'index.html'].filter((f) => /\.(tsx?|css|html|js|ics)$/.test(f));
  await check('venue is spelt البوعيثة everywhere; the misspelling appears nowhere', async () => {
    const bad = textFiles.filter((f) => readFileSync(f, 'utf8').includes(MISSPELT));
    assert.deepEqual(bad, []);
    assert(files('dist').some((f) => f.endsWith('.js') && readFileSync(f, 'utf8').includes('البوعيثة')));
    return `${textFiles.length} files scanned`;
  });
  await check('event details live in one file', async () => {
    const elsewhere = files('src').filter((f) => !f.endsWith(join('config', 'event.ts')) && /2026|غزل|goo\.gl|Asia\/Baghdad/.test(readFileSync(f, 'utf8')));
    assert.deepEqual(elsewhere, []);
  });
  await check('build stays light', async () => {
    const size = (pattern) => files('dist').filter((f) => pattern.test(f)).reduce((sum, f) => sum + statSync(f).size, 0);
    const js = size(/\.js$/);
    const audio = size(/\.mp3$/);
    const art = size(/assets[\\/].*\.(jpg|png)$/);
    assert(js < 400 * 1024 && audio < 1500 * 1024 && art < 1100 * 1024, `script ${js}, music ${audio}, embossed pictures ${art} bytes`);
    return `script ${(js / 1024).toFixed(0)} KB, embossed pictures ${(art / 1024).toFixed(0)} KB, music ${(audio / 1024).toFixed(0)} KB (music loads only after the first tap)`;
  });
}

const version = browser.version();
await browser.close();
await server?.close();

// ---------------------------------------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
const lines = [
  '# Test report',
  '',
  `- Tested: ${BASE}`,
  `- When: ${new Date().toISOString()}`,
  `- Browser: Chrome ${version} (headless), emulating each device's screen size, pixel ratio, touch and user agent`,
  `- Result: **${results.length - failed.length} of ${results.length} checks passed**`,
  '',
  `Regenerate with \`${liveUrl ? `npm run test:e2e -- ${BASE}` : 'npm run build && npm run test:e2e'}\`. Screenshots of every stage are in \`${OUT}/\`.`,
  '',
];
for (const group of [...new Set(results.map((r) => r.scope))]) {
  lines.push(`## ${group}`, '', '| | Check | Detail |', '|---|---|---|');
  for (const r of results.filter((x) => x.scope === group)) lines.push(`| ${r.ok ? 'PASS' : '**FAIL**'} | ${r.name} | ${String(r.note).replace(/\|/g, '/')} |`);
  lines.push('');
}
lines.push(
  '## Not covered by this run',
  '',
  '- Real iPhone Safari and real Android hardware: the run uses desktop Chrome emulating those screens, so engine-specific rendering on a physical phone is not proven here.',
  '- The WhatsApp preview itself: the tags and image it reads are verified, but only sending the link in WhatsApp shows the final card.',
  '- How the music sounds: playback, looping and levels are checked, not the listening experience.',
  '',
);
writeFileSync(REPORT, lines.join('\n'));

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  [${r.scope}] ${r.name}${r.note ? `  (${r.note})` : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
