// The flourish: a small divider between blocks of text.
//
// A sprig of myrtle (yas, the green of Iraqi engagement trays): its five-petalled blossom at the
// centre and, to each side, a slender stem that rides one slow S-curve and thins away to a point,
// with long narrow leaves set alternately along it, each a little smaller than the last.
//
// Only the right half is drawn. The left half is the same markup mirrored about the centre line,
// so the shapes are symmetric by construction; the light then falls on both from the top left.
//
// Two things about that light shaped the drawing:
//  - A ridge running from the top left to the bottom right has nothing to catch it. Leaves
//    standing at 45 degrees would be crisp on one arm and ghosts on the other, so they lie
//    within about 25 degrees of the stem, where both arms read alike.
//  - A leaf with a blunt foot shows that foot as a bright fleck on one arm and a dark tick on the
//    other. Each leaf therefore leaves the stem almost along it and only then swings out.

const NAME = 'flourish';

/** Distance along a curve, so leaves can be set at measured intervals. */
function measure(curve, n = 240) {
  const table = [0];
  let prev = curve.at(0);
  for (let i = 1; i <= n; i++) {
    const p = curve.at(i / n);
    table.push(table[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
    prev = p;
  }
  const length = table[n];
  const tAt = (s) => {
    if (s <= 0) return 0;
    if (s >= length) return 1;
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid] < s) lo = mid;
      else hi = mid;
    }
    return (lo + (s - table[lo]) / (table[hi] - table[lo])) / n;
  };
  return { length, tAt };
}

// Everything that can be tuned, so that trial sheets can vary one thing at a time.
export const DEFAULTS = {
  // Paper as it comes, but for the cast shadow. The sprig stands lower than the big pieces, and a
  // lower relief throws a shorter shadow: the stock shadow, made for blooms and frames, is as
  // wide as these leaves and smudges them. Same strength, about two thirds of the reach.
  material: { base: 'paper', cast: { dx: 0.9, dy: 1.2, blur: 1.25, strength: 0.2 } },
  // Three picture pixels to the design pixel: the piece is tiny, and on the many phones that
  // show three device pixels per CSS pixel a 2x picture would be enlarged and lose its edge.
  scale: 3,
  // Heights. The piece is small, so nothing stands as high as the beads and blooms of the big
  // pieces: enough to be crisp, not enough to look padded.
  stem: 0.7,
  leaf: [0.56, 0.37, 0.2], // at the swell of a leaf, at its point, and where it leaves the stem
  petal: [0.62, 0.35], // at the crown of a petal, at its edge
  eye: 0.9,
  wave: 3.2, // how far the stem swings to either side of the centre line
  reach: 88, // where the stem ends, from the centre
  out: 14, // the angle at which a leaf leaves the stem
  along: 28, // and the angle of its point to the stem
  slim: 0.25, // width of a leaf over its length
  // [distance along the stem from the blossom, side (-1 above, 1 below), length]
  leaves: [
    [9, -1, 14.5],
    [18.5, 1, 14.5],
    [28.5, -1, 13.8],
    [38.5, 1, 12.9],
    [48.5, -1, 11.8],
    [58, 1, 10.6],
    [67, -1, 9.3],
    [75.5, 1, 7.9],
  ],
};

export function make(name = NAME, options = {}) {
  const o = { ...DEFAULTS, ...options };
  return {
    name,
    width: 200,
    height: 30,
    material: o.material,
    scale: o.scale,
    draw({ W, H, f, grey, rad, cubic, taper }) {
      const cx = W / 2;
      const cy = H / 2;
      let defs = '';
      let serial = 0;

      // A leaf whose midline leaves along a0 and arrives along a1, drawn out to a fine point;
      // low where it slips out from under the stem, highest at its swell, sinking towards the tip.
      const leaf = (bx, by, a0, a1, len, wid) => {
        const k = len * 0.36;
        const am = (a0 + a1) / 2;
        const tip = [bx + Math.cos(am) * len, by + Math.sin(am) * len];
        const line = cubic(
          [bx, by],
          [bx + Math.cos(a0) * k, by + Math.sin(a0) * k],
          [tip[0] - Math.cos(a1) * k, tip[1] - Math.sin(a1) * k],
          tip,
        );
        const id = `${name}-l${serial++}`;
        defs +=
          `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(bx)}" y1="${f(by)}" x2="${f(tip[0])}" y2="${f(tip[1])}">` +
          `<stop offset="0.04" stop-color="${grey(o.leaf[2])}"/><stop offset="0.36" stop-color="${grey(o.leaf[0])}"/>` +
          `<stop offset="1" stop-color="${grey(o.leaf[1])}"/></linearGradient>`;
        const blade = (t) => {
          const g = t ** 0.9;
          const s = Math.sin(Math.PI * g);
          return wid * (g < 0.5 ? s ** 1.6 : s ** 1.4);
        };
        return `<path d="${taper(line, blade, 40)}" fill="url(#${id})"/>`;
      };

      // ---- the stem
      const stem = cubic([cx + 4, cy + 0.6], [cx + 29, cy + o.wave], [cx + o.reach - 30, cy - o.wave], [cx + o.reach, cy - 1]);
      const run = measure(stem);

      // ---- the leaves, under the stem so that it runs unbroken over their bases
      let half = '';
      for (const [s, side, len] of o.leaves) {
        const t = run.tAt(s);
        const [x, y] = stem.at(t);
        const h = stem.heading(t);
        half += leaf(x, y, h + side * rad(o.out), h + side * rad(o.along), len, Math.max(2.4, len * o.slim));
      }
      {
        // the last leaf carries the line of the stem on to its point
        const t = run.tAt(run.length - 5);
        const [x, y] = stem.at(t);
        const h = stem.heading(t);
        half += leaf(x, y, h, h + rad(4), 9.5, 2.5);
      }
      half += `<path d="${taper(stem, (t) => 1.5 - 0.5 * t, 90)}" fill="${grey(o.stem)}"/>`;

      // ---- the blossom: five round petals about a bead. The upright petal sits on the centre
      // line, so each half shows half of it.
      defs +=
        `<radialGradient id="${name}-petal" cx="0.5" cy="0.5" r="0.5">` +
        `<stop offset="0.3" stop-color="${grey(o.petal[0])}"/><stop offset="1" stop-color="${grey(o.petal[1])}"/></radialGradient>`;
      for (const a of [-90, -18, 54]) {
        half += `<circle cx="${f(cx + Math.cos(rad(a)) * 5.1)}" cy="${f(cy + Math.sin(rad(a)) * 5.1)}" r="2.95" fill="url(#${name}-petal)"/>`;
      }
      half += `<circle cx="${f(cx)}" cy="${f(cy)}" r="1.6" fill="${grey(o.eye)}"/>`;

      defs += `<clipPath id="${name}-half"><rect x="${f(cx)}" y="0" width="${f(cx)}" height="${H}"/></clipPath>`;
      return (
        `<defs>${defs}</defs>` +
        `<g clip-path="url(#${name}-half)">${half}</g>` +
        `<g transform="translate(${W} 0) scale(-1 1)"><g clip-path="url(#${name}-half)">${half}</g></g>`
      );
    },
  };
}

export default make();
