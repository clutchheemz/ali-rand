// The satin band that runs right across the card and off both sides of the screen.
// Lengthwise folds, drawn a little tighter toward the middle where the bow gathers the ribbon.
//
// For placing it: the band's centre line is y = 32. Its selvedges lie at about y = 6 and y = 58 and
// run off the left and right edges of the 400 x 64 picture. Toward x = 200 they draw in like a
// funnel, to about y = 16.5 and y = 47.5 at the middle, so that the band is gathered into the bow's
// knot while it is tied, and each half ends in a gathered taper once the site cuts the band at
// x = 200 and slides the halves apart.
import { SATIN, createField, fieldImage, clamp, lerp, smooth, gauss } from './_cloth.mjs';

const WIDTH = 400;
const HEIGHT = 64;
const BLEED = 24;
const CX = 200; // where the bow sits, and where the site cuts the band in two

// how far a place is from the middle, with the very middle rounded off so that nothing kinks there
const fromMiddle = (x) => Math.hypot(x - CX, 5) - 5;
// the two selvedges: nearly straight, never quite, and drawn in like a funnel where the bow gathers them
const waist = (x) => 2 * gauss(x - CX, 70) + 8.5 * Math.exp(-fromMiddle(x) / 26);
const topEdge = (x) => 6 + waist(x) + 0.55 * Math.sin(x / 41 + 0.7) + 0.3 * Math.sin(x / 15.3 + 2.1);
const bottomEdge = (x) => 58 - waist(x) + 0.5 * Math.sin(x / 47 + 3.9) + 0.32 * Math.sin(x / 17.9 + 0.4);

function build({ rng }) {
  const field = createField({ x0: -BLEED, y0: -BLEED, width: WIDTH + 2 * BLEED, height: HEIGHT + 2 * BLEED });
  const { W, H, z, scale, x0, y0 } = field;
  const rand = rng(41);

  // long folds that run the whole length, swelling and fading as they go: [place across, height, half-width px]
  const longFolds = [
    [0.19, 0.085, 5.2],
    [0.4, -0.075, 6],
    [0.62, 0.095, 5.8],
    [0.84, -0.06, 5],
  ].map(([v, a, w]) => ({
    v,
    a,
    w,
    p1: rand() * 6.28,
    p2: rand() * 6.28,
    p3: rand() * 6.28,
    beat: 70 + rand() * 45,
    slant: (rand() - 0.5) * 0.09, // no fold runs quite parallel to the selvedge
  }));

  // the gathers under the knot: narrow ridges, each with its own reach to the left and right
  const gathers = [0.1, 0.26, 0.42, 0.58, 0.74, 0.9].map((v) => ({
    v: v + (rand() - 0.5) * 0.05,
    a: 0.15 + rand() * 0.07,
    left: 38 + rand() * 54,
    right: 38 + rand() * 54,
    drift: (rand() - 0.5) * 0.06,
  }));

  // soft pulls: faint ridges drawn out of the gather at a shallow slant
  const pulls = [-0.15, -0.07, 0.06, 0.13].flatMap((m) =>
    [-1, 1].map((side) => ({
      side,
      m: m + (rand() - 0.5) * 0.04,
      y: 32 + m * 70 + (rand() - 0.5) * 6,
      a: 0.045 + rand() * 0.03,
      bend: (rand() - 0.5) * 0.0012,
    })),
  );

  for (let py = 0; py < H; py++) {
    const y = (py + 0.5) / scale + y0;
    for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / scale + x0;
      const yt = topEdge(x);
      const yb = bottomEdge(x);
      const wide = yb - yt;
      const v = clamp((y - yt) / wide);
      const d = fromMiddle(x);
      const near = gauss(d, 80);

      let h = 0.4 + 0.08 * Math.pow(1 - (2 * v - 1) ** 2, 0.8);

      for (const fold of longFolds) {
        const place =
          fold.v + fold.slant * ((x - CX) / 200) + 0.04 * Math.sin(x / 71 + fold.p1) + 0.016 * Math.sin(x / 24 + fold.p2);
        const amp = fold.a * (0.55 + 0.45 * Math.sin(x / fold.beat + fold.p3)) * (1 + 0.9 * near);
        // a fold lies over a little: its upper flank is the steeper one
        const across = (v - place) * wide;
        h += amp * gauss(across, across < 0 ? fold.w * 0.8 : fold.w * 1.22);
      }

      for (const g of gathers) {
        const reach = x < CX ? g.left : g.right;
        const amp = g.a * Math.exp(-Math.pow(d / reach, 1.6));
        if (amp < 0.002) continue;
        const place = 0.5 + (g.v - 0.5) * (1 - 0.1 * gauss(d, 40)) + g.drift * (d / 100);
        h += amp * gauss((v - place) * wide, 2.9 + d / 22);
      }

      for (const p of pulls) {
        if ((x - CX) * p.side < 0) continue;
        const line = p.y + p.m * d + p.bend * d * d;
        h += p.a * Math.exp(-d / 110) * smooth(6, 30, d) * gauss(y - line, 4.5);
      }

      // the selvedge: a woven edge a hair proud of the satin, turning down to the card
      const edge = Math.min(y - yt, yb - y);
      h -= 0.045 * (1 - smooth(-2, 3, edge));
      h += 0.028 * gauss(edge - 1.1, 1) - 0.016 * gauss(edge - 3.2, 1.2);
      // well outside the silhouette nothing shows: let the field settle to one flat level
      z[py * W + px] = lerp(clamp(h), 0.5, smooth(-7, -20, edge));
    }
  }
  return field;
}

let built;
const field = (kit) => (built ??= build(kit));

export default {
  name: 'band',
  width: WIDTH,
  height: HEIGHT,
  bleed: BLEED,
  material: SATIN,
  draw(kit) {
    return fieldImage(field(kit));
  },
  mask({ f }) {
    const pts = [];
    for (let x = -BLEED; x <= WIDTH + BLEED; x += 2) pts.push(`${x} ${f(topEdge(x))}`);
    for (let x = WIDTH + BLEED; x >= -BLEED; x -= 2) pts.push(`${x} ${f(bottomEdge(x))}`);
    return `<path d="M${pts.join('L')}Z" fill="#fff"/>`;
  },
};
