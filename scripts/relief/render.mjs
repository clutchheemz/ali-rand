// Turns a drawn height map into an embossed "light map": a grey picture in which mid-grey is
// flat paper, lighter is a slope facing the light and darker is a slope in shade. The site lays
// that picture over any surface colour with `background-blend-mode: hard-light`, so one picture
// embosses ivory paper, burgundy wax or satin alike.
//
// The lighting is done once, here, by Chrome's SVG filters and saved as a picture. Doing it live
// in each guest's browser would look different on every screen density and cost phones dearly.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

/** Picture pixels per design pixel, unless a piece sets its own `scale`. */
export const SCALE = 2;

/** Where the light stands, in degrees clockwise from east: 225 is the top left. */
const LIGHT = 225;

/**
 * How each material answers the light.
 *   colour   what the previews are laid over (the site sets the real colour in CSS)
 *   soften   blur of the height map in design px: the width of every slope
 *   depth    how far the relief stands up
 *   curve    output tone at five evenly spaced input tones; the middle one must stay 0.5
 *   lift     how much lighter a raised face is than the ground
 *   cast     the soft shadow a raised shape throws on the ground beside it
 *   gloss    the specular glint: constant, exponent, elevation of the light, gain
 */
export const MATERIALS = {
  paper: {
    colour: '#f1e9dc',
    soften: 1.1,
    depth: 3.2,
    curve: [0.3, 0.41, 0.5, 0.72, 0.97],
    lift: 0.1,
    cast: { dx: 1.3, dy: 1.7, blur: 1.8, strength: 0.2 },
    gloss: null,
  },
  wax: {
    colour: '#7b1f2b',
    soften: 1.5,
    depth: 4,
    curve: [0.1, 0.3, 0.5, 0.66, 0.8],
    lift: 0.04,
    cast: { dx: 1.2, dy: 1.8, blur: 2.2, strength: 0.3 },
    gloss: { constant: 1.3, exponent: 24, elevation: 50, gain: 1.5 },
  },
  satin: {
    colour: '#e8d6c8',
    soften: 2.4,
    depth: 3.4,
    curve: [0.2, 0.37, 0.5, 0.7, 0.9],
    lift: 0.03,
    cast: null,
    gloss: { constant: 1.1, exponent: 7, elevation: 42, gain: 0.9 },
  },
};

/** A piece names a material, or overrides parts of one: { base: 'paper', depth: 5 }. */
export function materialOf(piece) {
  const m = piece.material ?? 'paper';
  if (typeof m === 'string') return MATERIALS[m];
  return { ...MATERIALS[m.base ?? 'paper'], ...m };
}

/** The lighting filter. Every length is in picture pixels, so the result never depends on the screen. */
function lightingFilter(m, s, w, h) {
  // flat ground must come out as grey 128, the one tone that leaves the surface under it untouched;
  // the lighting hands us 127.5, so the middle of the curve is nudged up to land on the right side
  const middle = (m.curve.length - 1) / 2;
  const table = m.curve.map((v, i) => (i === middle ? v + 0.004 : v)).join(' ');
  const parts = [
    `<feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="raw"/>`,
    `<feGaussianBlur in="raw" stdDeviation="${m.soften * s}" result="h"/>`,
    // elevation 30 with a diffuse constant of 1 makes flat ground exactly mid-grey
    `<feDiffuseLighting in="h" surfaceScale="${m.depth * s}" diffuseConstant="1" lighting-color="#fff" result="lit">` +
      `<feDistantLight azimuth="${LIGHT}" elevation="30"/></feDiffuseLighting>`,
    `<feComponentTransfer in="lit" result="toned">` +
      ['R', 'G', 'B'].map((c) => `<feFunc${c} type="table" tableValues="${table}"/>`).join('') +
      `</feComponentTransfer>`,
  ];
  const layers = ['toned'];
  if (m.cast) {
    parts.push(
      `<feOffset in="h" dx="${m.cast.dx * s}" dy="${m.cast.dy * s}" result="off"/>`,
      `<feGaussianBlur in="off" stdDeviation="${m.cast.blur * s}" result="offb"/>`,
      `<feComposite in="offb" in2="h" operator="out" result="outside"/>`,
      `<feFlood flood-color="#000" result="black"/>`,
      `<feComposite in="black" in2="outside" operator="in" result="cast0"/>`,
      `<feComponentTransfer in="cast0" result="cast"><feFuncA type="linear" slope="${m.cast.strength}"/></feComponentTransfer>`,
    );
    layers.push('cast');
  }
  if (m.lift) {
    parts.push(
      `<feFlood flood-color="#fff" result="white"/>`,
      `<feComposite in="white" in2="h" operator="in" result="lift0"/>`,
      `<feComponentTransfer in="lift0" result="lift"><feFuncA type="linear" slope="${m.lift}"/></feComponentTransfer>`,
    );
    layers.push('lift');
  }
  if (m.gloss) {
    const g = m.gloss;
    // what flat ground would reflect: taken off, so flat stays mid-grey
    const half = ((90 - g.elevation) / 2) * (Math.PI / 180);
    const flat = Math.min(1, g.constant * Math.cos(half) ** g.exponent);
    parts.push(
      `<feSpecularLighting in="h" surfaceScale="${m.depth * s}" specularConstant="${g.constant}" specularExponent="${g.exponent}" lighting-color="#fff" result="gloss0">` +
        `<feDistantLight azimuth="${LIGHT}" elevation="${g.elevation}"/></feSpecularLighting>`,
      `<feComponentTransfer in="gloss0" result="gloss"><feFuncA type="linear" slope="${g.gain}" intercept="${-g.gain * flat}"/></feComponentTransfer>`,
    );
    layers.push('gloss');
  }
  return (
    `<filter id="relief" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB">` +
    parts.join('') +
    `<feMerge>${layers.map((l) => `<feMergeNode in="${l}"/>`).join('')}</feMerge></filter>`
  );
}

const flip = (v, W, H) =>
  [v.flipX && `translate(${W} 0) scale(-1 1)`, v.flipY && `translate(0 ${H}) scale(1 -1)`].filter(Boolean).join(' ');

const page = (body, w, h, background) =>
  `<!doctype html><meta charset="utf-8"><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${background}">${body}</body>`;

/**
 * Renders pieces to light maps (JPEG), silhouettes (PNG, only for pieces with a mask) and
 * previews of how each will look on its material.
 *
 * A piece is { name, width, height, draw(ctx) } in design px, plus optionally:
 *   material   a name from MATERIALS, or { base, ...overrides }
 *   variants   { key: { flipX, flipY } }: one picture per key, mirrored before the light falls
 *   mask(ctx)  the silhouette in white, for pieces that are not a rectangle of their surface
 *   scale      picture pixels per design pixel (default 2)
 *   bleed      design px drawn beyond every edge and then cropped off, so slopes that run off
 *              the picture (a tile, a band) are lit as if they carried on
 *   ground     the colour behind the piece in its preview
 * Returns one record per picture written.
 */
export async function renderPieces(pieces, { out, preview, kit = {}, quality = 84, scale, log = console.log }) {
  mkdirSync(out, { recursive: true });
  if (preview) mkdirSync(preview, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
  const written = [];
  try {
    const tab = await browser.newPage({ deviceScaleFactor: 1 });
    for (const piece of pieces) {
      const m = materialOf(piece);
      const s = Math.max(scale ?? 0, piece.scale ?? SCALE); // --scale raises every piece to at least that
      const W = piece.width;
      const H = piece.height;
      const b = (piece.bleed ?? 0) * s;
      const w = W * s;
      const h = H * s;
      const fw = w + 2 * b; // the full canvas, bleed included
      const fh = h + 2 * b;
      const clip = { x: b, y: b, width: w, height: h };
      const ctx = { W, H, ...kit };
      const art = piece.draw(ctx);
      const silhouette = piece.mask?.(ctx);
      const variants = piece.variants ?? { '': {} };
      const shown = [];
      for (const [key, v] of Object.entries(variants)) {
        const name = piece.name + (key ? `-${key}` : '');
        const place = `translate(${b} ${b}) scale(${s}) ${flip(v, W, H)}`;
        await tab.setViewportSize({ width: fw, height: fh });

        // the light map
        await tab.setContent(
          page(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${fw}" height="${fh}" viewBox="0 0 ${fw} ${fh}" style="display:block">` +
              `<defs>${lightingFilter(m, s, fw, fh)}</defs>` +
              `<g filter="url(#relief)"><rect width="${fw}" height="${fh}" fill="#000"/>` +
              `<g transform="${place}">${art}</g></g></svg>`,
            fw,
            fh,
            '#000',
          ),
        );
        const jpeg = await tab.screenshot({ type: 'jpeg', quality, clip });
        writeFileSync(path.join(out, `${name}.jpg`), jpeg);
        const record = { name, file: `${name}.jpg`, width: W, height: H, bytes: jpeg.length };

        // the silhouette, for pieces that are not rectangles of paper (a seal, a bow)
        let png = null;
        if (silhouette) {
          await tab.setContent(
            page(
              `<svg xmlns="http://www.w3.org/2000/svg" width="${fw}" height="${fh}" viewBox="0 0 ${fw} ${fh}" style="display:block">` +
                `<g transform="${place}">${silhouette}</g></svg>`,
              fw,
              fh,
              'transparent',
            ),
          );
          png = await tab.screenshot({ type: 'png', omitBackground: true, clip });
          writeFileSync(path.join(out, `${name}-mask.png`), png);
          record.mask = `${name}-mask.png`;
          record.maskBytes = png.length;
        }
        written.push(record);
        shown.push({ name, jpeg, png });
        log(`${name}.jpg  ${W}x${H}  ${(jpeg.length / 1024).toFixed(1)} KB${png ? `  + mask ${(png.length / 1024).toFixed(1)} KB` : ''}`);
      }

      // the preview: exactly what the site does, laid over the material's colour
      if (preview) {
        const zoom = Math.max(1, Math.min(3, 760 / Math.max(W, H)));
        const pw = Math.round(W * zoom);
        const ph = Math.round(H * zoom);
        const ground = piece.ground ?? (silhouette ? MATERIALS.paper.colour : m.colour);
        const tiles = shown
          .map(({ jpeg, png }) => {
            const url = png && `url(data:image/png;base64,${png.toString('base64')}) center/100% 100% no-repeat`;
            const mask = png ? `-webkit-mask:${url};mask:${url};` : '';
            const shade = png ? 'filter:drop-shadow(0 5px 6px rgba(60,30,20,.35));' : '';
            return (
              `<div style="${shade}"><div style="width:${pw}px;height:${ph}px;background-color:${m.colour};` +
              `background-image:url(data:image/jpeg;base64,${jpeg.toString('base64')});background-size:100% 100%;` +
              `background-blend-mode:hard-light;${mask}"></div></div>`
            );
          })
          .join('');
        const gap = 24;
        await tab.setViewportSize({ width: shown.length * pw + (shown.length + 1) * gap, height: ph + gap * 2 });
        await tab.setContent(
          `<!doctype html><meta charset="utf-8"><body style="margin:0;display:flex;gap:${gap}px;padding:${gap}px;background:${ground}">${tiles}</body>`,
        );
        const file = path.join(preview, `${piece.name}.png`);
        writeFileSync(file, await tab.screenshot({ type: 'png' }));
        log(`  preview: ${file}`);
      }
    }
  } finally {
    await browser.close();
  }
  return written;
}
