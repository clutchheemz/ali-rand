// A backdrop of date-palm fronds in low relief, laid over one another like plumage and running
// off every edge. Used full width behind a plain card, its top and bottom faded by the site.
//
// How it is built
//   Every frond is a curved rib with slim leaflets down both sides, set in small fanned groups
//   as they are on a date palm. A leaflet is a blade folded along its length: highest on the
//   crease, falling away in two facets to its edges, with an undercut where it lies on its
//   neighbour. Fronds are painted from the lowest to the highest. Each one finds its own height:
//   full height where it is free, a step lower where a later frond lies over it, and a little
//   lower still just as it slips beneath, so wherever two fronds meet the upper one stands clear.
//
// Why every rib runs from the lower left to the upper right
//   The light comes from the top left. A ridge that runs along the light's own line has both
//   flanks lit alike and goes flat, so the ribs are kept across it and each leaflet is steered
//   at least CLEAR degrees off it. For the same reason the piece must never be mirrored in one
//   direction only; turned right round (flipX and flipY together) it still reads.

const DEG = 180 / Math.PI;
const smooth = (a, b, v) => {
  const k = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** How far (degrees, 0..90) a direction lies from the line the light travels along. */
const offLight = (h) => {
  let d = (((h * DEG - 45) % 180) + 180) % 180;
  if (d > 90) d = 180 - d;
  return d;
};

const W = 400;
const H = 420;
const EDGE = 30; // the bleed: how far the drawing runs beyond the canvas
const CLEAR = 32; // leaflets are kept at least this many degrees off the light's line

// heights
const TOP = 0.73; // the crease of a blade on a frond nothing lies over
const STEP = 0.3; // how far a frond sinks under a frond lying over it
const DIP = 0.45; // the share of a step it sinks further just as it slips beneath
const FLOOR = 0.28; // nothing of the canopy sinks below this
const SPINE = 0.14; // how far the blades climb as they come in to the rib
/** How many steps down a frond lies under `n` covering fronds: the second and third count for less. */
const sunk = (n) => (n <= 1 ? n : 1 + 0.55 * Math.tanh((n - 1) * 1.2));

/** Half-width of a leaflet along its length: a folded base, a long even blade, a fine point. */
const shape = (u) => {
  const rise = u < 0.16 ? 0.6 + 0.4 * Math.sin((u / 0.16) * Math.PI * 0.5) : 1;
  const fall = u < 0.42 ? 1 : 1 - Math.pow((u - 0.42) / 0.58, 1.25);
  return rise * fall;
};

/** The geometry of one frond that other fronds need to know about. */
export function build(ctx, o) {
  const c = ctx.cubic(...o.rib);
  const N = 300;
  const tab = [0];
  let prev = c.at(0);
  for (let i = 1; i <= N; i++) {
    const p = c.at(i / N);
    tab.push(tab[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
    prev = p;
  }
  const total = tab[N];
  /** The curve parameter at a distance along the rib. */
  const tAt = (d) => {
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tab[mid] < d) lo = mid;
      else hi = mid;
    }
    return (lo + (d - tab[lo]) / (tab[hi] - tab[lo] || 1)) / N;
  };
  // a frond with a tip narrows over its last half
  const from = o.tip ? 0.5 : 2;
  const tipS = (k) => (k > from ? (k - from) / (1 - from) : 0);
  const reach = (k) => o.reach * (1 - 0.68 * Math.pow(tipS(k), 1.3));
  /** The angle (degrees) a leaflet opens from the rib, closed just enough to stay off the light's line. */
  const open = (k, r, side) => {
    let a = o.angle[0] + (o.angle[1] - o.angle[0]) * k - o.tipClose * tipS(k);
    if (o.deep) return a;
    while (a > 30 && offLight(r + (side * (a - 0.45 * o.curl)) / DEG) < CLEAR) a -= 0.5;
    return a;
  };
  /** How far from the rib the leaflet tips reach, on one side. */
  const band = (k, r, side) => reach(k) * Math.sin((open(k, r, side) - 0.45 * o.curl) / DEG);
  const poly = [];
  for (let i = 0; i <= 90; i++) {
    const d = (total * i) / 90;
    const t = tAt(d);
    const [x, y] = c.at(t);
    poly.push([x, y, d / total, c.heading(t)]);
  }
  /**
   * How this frond bears on a point: [cover, near]. `cover` is 1 where the frond lies over the
   * point, fading to 0 a little way beyond its fringe; `near` rises only close under the fringe.
   */
  const cover = (x, y) => {
    let best = 1e9;
    let at = poly[0];
    for (const p of poly) {
      const dd = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
      if (dd < best) {
        best = dd;
        at = p;
      }
    }
    const [px, py, k, r] = at;
    const side = Math.cos(r) * (y - py) - Math.sin(r) * (x - px) >= 0 ? 1 : -1;
    const b = band(k, r, side);
    const dist = Math.sqrt(best);
    return [smooth(b + 52, b + 2, dist), smooth(b + 16, b + 2, dist)];
  };
  return { o, c, total, tAt, tipS, reach, open, band, poly, cover };
}

function frond(ctx, all, index) {
  const { f, grey, taper, rng } = ctx;
  const { o, c, total, tAt, tipS, reach, open } = all[index];
  const R = rng(o.seed);
  const later = all.slice(index + 1).filter((p) => !p.o.deep);
  /** The height of this frond's creases at a point, given what lies over it there. */
  const levelAt = (x, y) => {
    if (o.deep) return o.level;
    let over = 0;
    let near = 0;
    for (const p of later) {
      const [cv, n] = p.cover(x, y);
      over += cv;
      near = Math.max(near, n);
    }
    return Math.max(FLOOR, TOP - STEP * (sunk(over) + DIP * near));
  };
  const ph = [R() * 6.28, R() * 6.28, R() * 6.28, R() * 6.28];
  const wave = (d, i) => Math.sin(d / (i % 2 ? 19 : 47) + ph[i]);
  const pts = (a) => a.map(([x, y]) => `${f(x)} ${f(y)}`).join('L');
  const spine = o.deep ? 0 : SPINE;
  let defs = '';
  let body = '';
  let skirt = '';
  let serial = 0;

  /**
   * One leaflet: its base on the rib, the heading it sets off on, its length and half-width,
   * its curl, which edge shows (`ex`), a small offset in height and how deep its undercut is.
   */
  const leaflet = (bx, by, h0, len, wmax, curl, ex, jit, groove) => {
    const n = 12;
    const C = [];
    const Hd = [];
    const Wd = [];
    let x = bx;
    let y = by;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      C.push([x, y]);
      Hd.push(h0 + curl * Math.pow(u, 1.4));
      Wd.push(wmax * shape(u));
      const hm = h0 + curl * Math.pow((i + 0.5) / n, 1.4);
      x += (Math.cos(hm) * len) / n;
      y += (Math.sin(hm) * len) / n;
    }
    // a line along the blade at a fraction q of its half-width (-1 and 1 are the two edges)
    const line = (q, a = 0, b = n) =>
      C.slice(a, b + 1).map(([px, py], i) => [
        px + Math.cos(Hd[i + a] + Math.PI / 2) * Wd[i + a] * q,
        py + Math.sin(Hd[i + a] + Math.PI / 2) * Wd[i + a] * q,
      ]);
    const strip = (qa, qb, a = 0, b = n) => `M${pts(line(qa, a, b))}L${pts(line(qb, a, b).reverse())}Z`;
    const id = `fronds-${index}-${serial++}`;
    const [tx, ty] = C[n];
    // the height of the crease along the blade: up on the spine at the rib, level along the
    // vane (sinking where the frond sinks), a little lower at the tip
    const hAt = (i) => levelAt(C[i][0], C[i][1]) + jit - o.drop * Math.pow(i / n, 1.7);
    const rise = [[0, 1], [0.035, 0.8], [0.07, 0.38], [0.11, 0]].map(([u, v]) => `<stop offset="${u}" stop-color="${grey(hAt(0) + spine * v)}"/>`).join('');
    const stops = rise + [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => `<stop offset="${f(i / n)}" stop-color="${grey(hAt(i))}"/>`).join('');
    defs += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(bx)}" y1="${f(by)}" x2="${f(tx)}" y2="${f(ty)}">${stops}</linearGradient>`;
    const whole = strip(-1, 1);
    // the skirt: the blade again, part-way up and slid away from the light, so the shaded side
    // of the frond falls in a longer slope and the overlap reads deep
    if (o.skirt) skirt += `<path d="${whole}" transform="translate(2.3 2.9)" fill="url(#${id})" fill-opacity="0.4"/>`;
    // everything cut into the blade is a share of its height, so it keeps its place as the frond sinks
    const mid = Math.max(0.15, hAt(5));
    const low = (delta) => f(Math.min(0.6, (delta * o.amp) / mid));
    // the undercut where this blade lies on its neighbour (not along the free tip)
    if (groove) body += `<path d="M${pts(line(ex, 0, 8))}" stroke="#000" stroke-opacity="${low(o.groove * groove)}" stroke-width="3.4" stroke-linecap="round" fill="none"/>`;
    body += `<path d="${whole}" fill="url(#${id})"/>`;
    // the fold: two facets falling from the crease to the edges, in small even steps
    const e = o.roof / o.facets.length;
    for (const q of o.facets) body += `<path d="${strip(q, 1)}${strip(-1, -q)}" fill="#000" fill-opacity="${low(e)}"/>`;
    // and the crease itself, a fine line standing a touch prouder
    if (o.crease) body += `<path d="${strip(-0.1, 0.1, 0, n - 1)}" fill="#fff" fill-opacity="${f(Math.min(0.5, (o.crease * o.amp) / (1.02 - mid)))}"/>`;
  };

  for (const side of [1, -1]) {
    const items = [];
    let d = side === 1 ? 2 : 2 + o.step / 2;
    // leaflets come in small groups that fan a little, as they do on a date palm
    let size = 3 + Math.floor(R() * 2);
    let j = Math.floor(R() * size);
    let group = 0;
    while (d < total - 2) {
      const t = tAt(d);
      const a = open(d / total, c.heading(t), side);
      items.push({ d, t, a, turn: (0.5 - j / (size - 1)) * o.fan, lead: j === 0, group });
      // closer leaflets are set further apart along the rib, so the texture stays even
      const spread = Math.pow(Math.sin(47 / DEG) / Math.sin(a / DEG), 0.6);
      d += o.step * (0.93 + 0.14 * R()) * (1 - o.tipStep * tipS(d / total)) * spread;
      if (++j >= size) {
        j = 0;
        group++;
        size = 3 + Math.floor(R() * 2);
      }
    }
    for (const it of items) {
      const k = it.d / total;
      const s = tipS(k);
      const [bx, by] = c.at(it.t);
      const far = o.reach + EDGE;
      if (bx < -far || bx > W + far || by < -far || by > H + far) continue;
      const r = c.heading(it.t);
      const ws = side === 1 ? 0 : 2;
      const alpha = (it.a + (3 * wave(it.d, ws) + it.turn + (R() - 0.5) * 2.5) * (1 - s)) / DEG;
      const len = reach(k) * (1 + (0.06 * wave(it.d, ws + 1) + (R() - 0.5) * 0.08) * (1 - s));
      const wmax = (o.blade / 2) * (0.95 + 0.1 * R()) * (1 - o.tipThin * s);
      const curl = (-side * o.curl * (0.6 + 0.8 * R())) / DEG;
      // each group sits a shade higher or lower than the next, and its first blade is cut in deeper
      const jit = 0.02 * wave(it.d, ws) + (it.group % 2 ? 0.014 : -0.014);
      // each blade laps the one before it, so the edge that shows is the one towards the base
      leaflet(bx, by, r + side * alpha, len, wmax, curl, side, jit, it.lead ? 1.5 : 1);
    }
  }
  if (o.tip) {
    // the last leaflet carries the rib on to a point
    const [ex, ey] = c.at(1);
    leaflet(ex, ey, c.heading(1), o.reach * 0.3, o.blade * 0.34, 0, 1, 0, 0);
  }

  // the rib: a shoulder, a rounded back and a crest, tapering to the tip, sinking where the frond sinks
  const end = o.tip ? 0.14 : 0.5;
  const ribW = (t) => o.ribW * (1 - (1 - end) * t) + 0.8;
  const [x1, y1] = c.at(0);
  const [x2, y2] = c.at(1);
  const along = (t) => {
    const [x, y] = c.at(t);
    return ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2);
  };
  const ribStops = [];
  for (let i = 0; i <= 36; i++) {
    const [x, y] = c.at(i / 36);
    ribStops.push([along(i / 36), levelAt(x, y)]);
  }
  const ribFill = (up) => {
    const id = `fronds-${index}-${serial++}`;
    const stops = ribStops.map(([a, l]) => `<stop offset="${f(a)}" stop-color="${grey(Math.min(1, l + up))}"/>`).join('');
    defs += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}">${stops}</linearGradient>`;
    return `url(#${id})`;
  };
  body += `<path d="${taper(c, (t) => ribW(t) + 3, 48)}" fill="${ribFill(spine)}"/>`;
  body += `<path d="${taper(c, ribW, 48)}" fill="${ribFill(spine + o.ribUp * 0.6)}"/>`;
  body += `<path d="${taper(c, (t) => ribW(t) * 0.42, 48)}" fill="${ribFill(spine + o.ribUp)}"/>`;
  return { defs, body: skirt + body };
}

// the deep fronds: a quiet bed under everything, seen only in the gaps between leaflet tips
const D = {
  deep: true, level: 0.26, blade: 12, step: 12, reach: 128, angle: [52, 46], curl: 10, drop: 0.05, ribW: 5, ribUp: 0.08,
  facets: [0.2, 0.47, 0.74], roof: 0.17, crease: 0, groove: 0.2, amp: 0.6, fan: 0, skirt: false,
  tipClose: 0, tipStep: 0, tipThin: 0,
};
// a frond of the canopy
const F = {
  blade: 13, step: 13.5, reach: 118, angle: [49, 45], curl: 11, drop: 0.04, ribW: 8, ribUp: 0.16,
  // the fold of a blade: four even steps from the crease to each edge, and a fine proud crease
  facets: [0.1, 0.33, 0.56, 0.8], roof: 0.28, crease: 0.08, groove: 0.19, amp: 1, fan: 4.5, skirt: true,
  // towards a frond's tip the leaflets close up, thin out and stand a little closer together
  tipClose: 17, tipStep: 0.15, tipThin: 0.5,
};
// fronds differ a little in size: the great arcs are bolder, the young crossing fronds finer
const sized = (k) => ({ blade: F.blade * k, step: F.step * k, reach: F.reach * k, ribW: F.ribW * k });
// the fronds lying lowest are modelled a little more quietly
const quiet = 0.86;

/**
 * The fronds, lowest first. Each rib runs from the base of the frond towards its tip, as the
 * four points of a cubic curve in design px. The great arcs fan out from beyond the lower left
 * corner; X1 and X2 are young fronds that end in a tip and cross them.
 */
export const LAYOUT = [
  { ...D, rib: [[-70, 130], [70, 220], [170, 380], [310, 500]], seed: 21 },
  { ...D, rib: [[50, -70], [200, 30], [300, 200], [480, 300]], seed: 22 },
  { ...D, rib: [[270, -70], [360, -10], [420, 60], [500, 110]], seed: 23 },
  { ...F, ...sized(0.95), name: 'C3', rib: [[345, 560], [385, 500], [440, 465], [540, 440]], seed: 46, amp: quiet },
  { ...F, ...sized(0.97), name: 'A0', rib: [[-80, 130], [-50, 50], [0, -15], [100, -65]], seed: 41, amp: quiet },
  // B's leaflets are longer, so the tips of A and C land on the solid part of its vanes
  { ...F, ...sized(1.02), name: 'B', rib: [[-60, 480], [30, 290], [190, 140], [470, 75]], seed: 43, amp: quiet, reach: F.reach * 1.2 },
  { ...F, ...sized(0.95), name: 'C2', rib: [[235, 540], [265, 440], [335, 375], [490, 330]], seed: 45, amp: quiet },
  { ...F, ...sized(0.84), name: 'X2', rib: [[250, 262], [272, 198], [296, 132], [330, 68]], seed: 52, tip: true },
  { ...F, ...sized(1.05), name: 'C', rib: [[115, 540], [140, 385], [255, 265], [480, 205]], seed: 44 },
  { ...F, ...sized(0.84), name: 'X1', rib: [[-70, 440], [25, 415], [100, 392], [165, 350]], seed: 51, tip: true },
  { ...F, ...sized(1.08), name: 'A', rib: [[-60, 330], [-15, 205], [70, 70], [285, -50]], seed: 42 },
];

export default {
  name: 'fronds',
  width: W,
  height: H,
  bleed: EDGE,
  material: { base: 'paper', depth: 4.4, soften: 1.4 },
  draw(ctx) {
    const { grey } = ctx;
    let defs = '';
    // the ground under the deep fronds, a little above the paper so no gap reads as a hole
    let body = `<rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="${grey(0.14)}"/>`;
    const all = LAYOUT.map((o) => build(ctx, o));
    for (let i = 0; i < all.length; i++) {
      const r = frond(ctx, all, i);
      defs += r.defs;
      body += r.body;
    }
    return `<defs>${defs}</defs>${body}`;
  },
};
