// The left curtain as a height field, in the design pixels of the "drape" piece (112 x 470).
// Used by the drape piece itself and by the valance, which shows the tops of both curtains
// hanging out from under it.

import { clamp, mix, sstep, bell, rng, curve, foldSet, folds, path, nearest, cover, over, bead, tassel, rope } from './_field.mjs';

export function makeDrape() {
  const rnd = rng(7341);

  // The inner edge of the cloth: straight under the valance, swept back to the tie, flaring to the hem.
  const inner0 = curve([
    [0, 100], [50, 101.2], [95, 102.4], [128, 101], [160, 97.6], [190, 92.4], [215, 86.4], [236, 79.8],
    [250, 75.4], [259, 73.6], [264, 72.8], [267.5, 70.5], [270.5, 64.5], [274, 62.9], [280, 62.6], [300, 63],
    [326, 64.6], [342, 68.2], [360, 74.2], [390, 83.6], [420, 91], [440, 95.6], [452, 98], [475, 100],
  ]);
  const inner = (y) => inner0(y) + 1.5 * Math.sin((y - 318) / 24) * sstep(335, 375, y);
  // The unseen line, off the canvas, that the folds are measured from: it too is drawn in at the tie.
  const outer = curve([
    [60, -66], [150, -62], [215, -48], [250, -32], [268, -22], [290, -28], [330, -42], [390, -55], [475, -60],
  ]);
  const TOP = [-66, 100]; // where those two lines stand at the top: fold positions below are x at the top
  const across = (x) => (x - TOP[0]) / (TOP[1] - TOP[0]);

  // The folds from the outer side to the inner edge (see foldSet for the fields; x = place at the top).
  const VALLEYS = [
    { x: -80, v: 0.22, r: 0.3 },
    { x: -62, v: 0.2, r: 0.2 },
    { x: -46, v: 0.26, r: 0.6 },
    { x: -28, v: 0.15, r: 0.2 },
    { x: -8, v: [[0, 0.18], [150, 0.16], [255, 0.12], [290, 0.13], [380, 0.2], [450, 0.17]], r: 0.15 },
    { x: 3, v: 0.36, r: 0.5, fade: [[0, 1], [205, 1], [244, 0], [296, 0], [345, 1]], one: 0.7 },
    { x: 14, v: [[0, 0.25], [150, 0.21], [255, 0.17], [290, 0.19], [380, 0.27], [450, 0.36]], r: 0.5 },
    { x: 24, v: [[0, 0.13], [255, 0.1], [290, 0.11], [380, 0.17], [450, 0.14]], r: 0.1 },
    { x: 34, v: 0.32, r: 0.4, fade: [[0, 1], [222, 1], [250, 0], [292, 0], [340, 1]], one: 0.66 },
    { x: 44, v: [[0, 0.12], [255, 0.09], [290, 0.1], [380, 0.17], [450, 0.13]], r: 0.35 },
    { x: 56, v: 0.4, r: 0.6, fade: [[0, 1], [150, 1], [236, 0.1], [300, 0.1], [370, 1]], one: 0.84 },
    { x: 68, v: [[0, 0.26], [150, 0.22], [255, 0.14], [290, 0.16], [380, 0.24], [450, 0.33]], r: 0.5 },
    { x: 80, v: [[0, 0.14], [255, 0.1], [290, 0.11], [380, 0.16], [450, 0.13]], r: 0.15 },
    // the leading edge turns back on itself along the sweep, a band that widens and narrows again
    { x: [[0, 94.5], [120, 94.5], [195, 89.5], [245, 89.5], [272, 93.5], [300, 94.5]], v: [[0, 0.3], [120, 0.3], [195, 0.2], [255, 0.2], [300, 0.3], [450, 0.3]], r: 0.3 },
    { x: 100, v: 0, r: 0.1 },
  ].map((d) => ({ ...d, u: typeof d.x === 'number' ? across(d.x) : d.x.map(([y, x]) => [y, across(x)]) }));
  const CRESTS = [
    { a: 0.54, k: 0.5, f: 1 },
    { a: 0.6, k: 0.45, f: 1 },
    { a: 0.5, k: 0.55, f: 1.1 },
    { a: 0.64, k: 0.5, f: 1 },
    { a: 0.66, k: 0.45, f: 1 },
    { a: 0.62, k: 0.55, f: 1 },
    { a: [[0, 0.44], [255, 0.49], [450, 0.44]], k: 0.5, f: 1.15 },
    { a: 0.62, k: 0.5, f: 1 },
    { a: 0.58, k: 0.55, f: 1 },
    { a: 0.78, k: 0.45, f: 0.95 },
    { a: 0.74, k: 0.5, f: 0.95 },
    { a: [[0, 0.49], [255, 0.52], [450, 0.46]], k: 0.5, f: 1.15 },
    { a: [[0, 0.63], [255, 0.65], [450, 0.66]], k: 0.56, f: 1 },
    { a: [[0, 0.47], [120, 0.47], [195, 0.6], [250, 0.58], [300, 0.47], [450, 0.47]], k: 0.5, f: 1 },
  ];
  const foldsAt = foldSet(rnd, VALLEYS, CRESTS, { wander: (y) => 0.013 + 0.017 * sstep(285, 390, y), aNoise: 0.1, vNoise: 0.2 });

  let rowY = NaN;
  let row = null;
  const rowAt = (y) => {
    if (y !== rowY) {
      row = foldsAt(y);
      row.xl = outer(y);
      row.xr = inner(y);
      rowY = y;
    }
    return row;
  };

  /** The bare cloth: [height, how far up its fold 0..1, position across the cloth 0..1]. */
  const cloth = (x, y) => {
    const r = rowAt(y);
    const u = (x - r.xl) / (r.xr - r.xl);
    if (u >= 1) return null;
    const [h, p] = folds(Math.max(u, r.b[0]), r.b, r.c, r.A, r.V, r.R, r.F);
    return [h, p, u];
  };

  // The cord of the tie-back, rising to its hook off the canvas, and what hangs from it.
  const cord = path([-34, 249.5], [0, 262], [40, 273.5], [68.8, 271.3], 60);
  const cordLength = cord[cord.length - 1][2];
  const cordCache = new Map();
  const cordY = (x) => {
    let v = cordCache.get(x);
    if (v !== undefined) return v;
    v = cord[cord.length - 1][1];
    if (x <= cord[0][0]) v = cord[0][1];
    else {
      for (let i = 0; i < cord.length - 1; i++) {
        if (x <= cord[i + 1][0]) {
          v = mix(cord[i][1], cord[i + 1][1], (x - cord[i][0]) / (cord[i + 1][0] - cord[i][0]));
          break;
        }
      }
    }
    cordCache.set(x, v);
    return v;
  };
  const KNOT = { x: 69.2, y: 271.4 };
  const TASSEL = { x: 71.6, y: 274.6, cord: 10.5, size: 1.05, high: 0.86 };

  // The hem: lowest at the outer side, rising towards the inner corner, scalloped by the folds.
  const hemBase = (x) => 456 - 21 * sstep(20, 100, x);
  const hemCache = new Map();
  const hemAt = (x) => {
    let v = hemCache.get(x);
    if (v === undefined) {
      const base = hemBase(x);
      const c = cloth(x, base - 8);
      // the scallops die away towards the inner corner, which is rounded off
      const near = clamp(1 - (x - outer(base)) / (inner(base) - outer(base)));
      v = base + (c ? 6 * (c[1] - 0.5) * sstep(0, 0.1, near) : 0) - 2.6 * (1 - sstep(0, 0.04, near));
      hemCache.set(x, v);
    }
    return v;
  };

  // behind the valance the cloth lies lower, so the valance stands in front of it; it comes
  // forward to its full depth as it falls clear
  const back = (y) => mix(0.5, 1, sstep(46, 165, y));

  function height(x, y) {
    let h = 0;
    const hy = hemAt(x);
    if (y < hy + 1) {
      const c = cloth(x, y);
      if (c) {
        const [hc, p, u] = c;
        const dy = y - cordY(x);
        // the cord bites into the cloth, which swells above and below it
        const squeeze = bell(dy, 0, 4.2);
        const swell = 0.16 * bell(dy, -10, 7) + 0.1 * bell(dy, 9.5, 7.5);
        h = hc * back(y) * (1 - 0.28 * squeeze) + swell * (0.5 + 0.5 * p);
        // a stitched line above the hem turns its edge into a soft roll
        h -= 0.16 * bell(y, hy - 6.5, 1.1) * sstep(0.015, 0.09, 1 - u);
        h *= cover(hy - y);
      }
    }

    // the tie-back: a twisted rope, its knot, and the tassel
    if (y > 240 && y < 340 && x < 84) {
      const acc = [0, 0];
      if (y < 282) {
        const [d, a] = nearest(cord, x, y);
        if (Math.abs(d) < 4 && a < cordLength) {
          const r = rope(d, a, 3.6, 9);
          over(acc, r[0], r[1]);
        }
        const k = bead(x, y, KNOT.x, KNOT.y, 4, 3.8, 0.66, 1);
        if (k) over(acc, k[0], k[1]);
      }
      tassel(acc, TASSEL, x, y);
      h = h * (1 - acc[0]) + acc[1];
    }
    return h;
  }

  return { height, inner, hemAt, cordY };
}
