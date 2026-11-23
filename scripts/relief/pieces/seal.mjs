// The wax seal: a pool of poured burgundy wax, the well a stamp pressed into it, and a rose
// standing in relief on the floor of the well.
//
// A note on how the wax is modelled. The press reads heights in 256 steps, so a broad, gentle
// slope comes out with a grain like a fingerprint, and the glint of wax shows it up cruelly.
// Every surface here is therefore either level or decidedly sloped: a flat apron, a steep-sided
// bead, crisp walls, small pillows. The large rounded forms are built the way a map shows a
// hill, as a stack of contours each a hair higher than the last, so their shape is exact.

const TAU = Math.PI * 2;
const rad = (deg) => (deg * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** The error function (Abramowitz and Stegun 7.1.26), for shaping blurred edges into profiles. */
const erf = (x) => {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
};

/** The distance inside a straight edge at which a blur of `sigma` leaves the tone v (0.5 at the edge). */
const depthOfTone = (v, sigma) => {
  let lo = 0;
  let hi = 80;
  for (let k = 0; k < 48; k++) {
    const mid = (lo + hi) / 2;
    if (0.5 * (1 + erf(mid / (sigma * Math.SQRT2))) < v) lo = mid;
    else hi = mid;
  }
  return lo;
};

/** tableValues for feFuncA: what each blurred tone becomes. */
const table = (fn, n = 96) => {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(Math.round(clamp(fn(i / n), 0, 1) * 1000) / 1000);
  return out.join(' ');
};

/**
 * A filter that blurs a small shape and turns the blur into a profile across its edge:
 * `inside(d)` is the strength d px inside the edge; outside the shape it is nothing.
 */
const edgeFilter = (id, sigma, inside) =>
  `<filter id="${id}" filterUnits="userSpaceOnUse" x="-10" y="-10" width="160" height="160" color-interpolation-filters="sRGB">` +
  `<feGaussianBlur stdDeviation="${sigma}"/><feComponentTransfer><feFuncA type="table" tableValues="${table((v) =>
    v < 0.5 ? 0 : inside(v >= 1 ? 99 : depthOfTone(v, sigma)),
  )}"/></feComponentTransfer></filter>`;

/** Where a rising function first reaches `goal` between lo and hi. */
const reach = (fn, goal, lo, hi) => {
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (fn(mid) < goal) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

/** A closed, smooth curve through points (Catmull-Rom, written as cubic Beziers). */
const closed = (pts, f) => {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    d +=
      `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
};

/** A polygon through points, closed. */
const poly = (pts, f) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;

/** A soft hump around the direction `deg`: 1 there, falling away; `tight` narrows it. */
const hump = (a, deg, tight) => Math.exp(tight * (Math.cos(a - rad(deg)) - 1));
/** Several humps run together into lobes: about the tallest of them wherever they overlap. */
const lobes = (list, a) => {
  let sum = 0;
  for (const [deg, push, tight] of list) sum += (push * hump(a, deg, tight)) ** 3;
  return Math.cbrt(sum);
};

// ---- the pool ------------------------------------------------------------------------------

const POOL = { x: 70, y: 70, r: 57 };
/** Where the stamp came down: a little down and left of the middle of the pool. */
const WELL = { x: 68.8, y: 71, r: 42, floor: 0.24 };

/** The lobes the wax ran into: [direction in degrees clockwise from east, push in px, tightness]. */
const LOBES = [
  [10, 6.4, 13],
  [55, 4.2, 20],
  [113, 8.2, 8],
  [168, 4.6, 18],
  [208, 6.6, 15],
  [262, 5.6, 10],
  [318, 7.4, 12],
];
/** How far the wax ran beyond the round, in the direction a. */
const run = (a) => lobes(LOBES, a);

const SAMPLES = 180;
/** The outline of the pool, or a line `inset(a)` px inside it. */
const poolPoints = (inset = () => 0) => {
  const pts = [];
  for (let i = 0; i < SAMPLES; i++) {
    const a = (i / SAMPLES) * TAU;
    const r = POOL.r + run(a) - inset(a);
    pts.push([POOL.x + Math.cos(a) * r, POOL.y + Math.sin(a) * r]);
  }
  return pts;
};

// The apron: the thin skirt of wax that ran out over the paper, level on top, rolling over
// at its edge to meet the paper.
const APRON = { level: 0.36, roll: 2.2, steps: 16 };
const rollOver = (d) => (d >= APRON.roll ? 1 : Math.sqrt(1 - (1 - d / APRON.roll) ** 2));

// The rim: where a tongue of wax stopped it swelled. Fat on the lobes, thin in the notches.
const RIM = { height: 0.54, steps: 14 };
const rimWidth = (a) => clamp(1.7 + 0.48 * run(a) + 0.4 * Math.sin(3 * a + 1.2), 1.5, 5.4);
const rimHeight = (a) => clamp((rimWidth(a) - 1.4) / 3.6, 0.2, 1) ** 0.9;
/** The rim across its width: full at the edge of the pool, easing down to the apron. */
const rimShape = (s) => (s <= 0.4 ? 1 : s >= 1 ? 0 : 0.5 * (1 + Math.cos((Math.PI * (s - 0.4)) / 0.6)));

// The bead: the thick lip the stamp squeezed up around itself. A steep-sided arch, fatter and
// taller where more wax was pushed, standing on the apron.
const BEAD = { crest: 0.94, spread: 4.9, inset: 6, width: 11.2, steps: 148 };
/** Where the bead bulges: a little round from the lobes of the pool, as squeezed wax lags the flow. */
const BEAD_SWELLS = [
  [4, 3.4, 13],
  [49, 2.3, 17],
  [107, 4.2, 10],
  [162, 2.4, 16],
  [202, 3.5, 14],
  [256, 3.0, 11],
  [312, 3.9, 13],
];
/** The bead around the well: for each direction, how wide it is from the wall of the well to its foot. */
const beadSpokes = () =>
  poolPoints().map(([x, y]) => {
    const a = Math.atan2(y - WELL.y, x - WELL.x);
    const room = Math.hypot(x - WELL.x, y - WELL.y) - WELL.r;
    // a little unevenness, as a hand never presses quite square
    const waver = 0.35 * Math.sin(9 * a + 0.7);
    return { a, width: clamp(BEAD.width + lobes(BEAD_SWELLS, a) + waver, 8.6, room - 1.6) };
  });
/** The height of the bead (0..1) x px out from its inner foot, where it is `w` px across. */
const beadArch = (x, w) => {
  const k = BEAD.spread * Math.SQRT2;
  const t = Math.max(0, erf(x / k) + erf((w - x) / k) - 1);
  return 0.55 * t ** 0.75 + 0.45 * t ** 2.5;
};

function pool({ f, grey }) {
  let defs = '';
  let s = '';

  // the roll at the edge of the pool: a mask that fades the wax away in fine steps
  let edge = '';
  for (let j = 0; j < APRON.steps; j++) {
    const before = j ? rollOver((j * APRON.roll) / APRON.steps) : 0;
    const after = rollOver(((j + 1) * APRON.roll) / APRON.steps);
    const inset = (j * APRON.roll) / APRON.steps;
    edge += `<path d="${closed(poolPoints(() => inset), f)}" fill="#fff" fill-opacity="${Math.round(((after - before) / (1 - before)) * 1000) / 1000}"/>`;
  }
  defs += `<mask id="seal-edge" maskUnits="userSpaceOnUse" x="0" y="0" width="140" height="140" style="mask-type:alpha">${edge}</mask>`;

  // each contour only ever raises the wax, so a low contour of the bead never cuts into the rim
  const higher = `style="mix-blend-mode:lighten"`;
  let wax = `<rect width="140" height="140" fill="${grey(APRON.level)}"/>`;

  // the rim, contour by contour
  for (let k = 1; k <= RIM.steps; k++) {
    const q = k / RIM.steps;
    const inner = poolPoints((a) => {
      const share = q / rimHeight(a);
      return share >= 1 ? -2 : rimWidth(a) * reach((v) => -rimShape(v), -share, 0.4, 1);
    });
    wax +=
      `<path d="${closed(poolPoints(() => -2), f)}${closed(inner, f)}" fill="${grey(APRON.level + q * (RIM.height - APRON.level))}" fill-rule="evenodd" ${higher}/>`;
  }

  // the bead, contour by contour
  const spokes = beadSpokes();
  const foot = WELL.r - BEAD.inset;
  for (let k = 1; k <= BEAD.steps; k++) {
    const q = k / BEAD.steps;
    const near = [];
    const far = [];
    for (const { a, width } of spokes) {
      const w = width + BEAD.inset;
      const x = beadArch(w / 2, w) < q ? w / 2 : reach((v) => beadArch(v, w), q, 0, w / 2);
      near.push([WELL.x + Math.cos(a) * (foot + x), WELL.y + Math.sin(a) * (foot + x)]);
      far.push([WELL.x + Math.cos(a) * (foot + w - x), WELL.y + Math.sin(a) * (foot + w - x)]);
    }
    wax += `<path d="${closed(far, f)}${closed(near, f)}" fill="${grey(APRON.level + q * (BEAD.crest - APRON.level))}" fill-rule="evenodd" ${higher}/>`;
  }
  s += `<g mask="url(#seal-edge)">${wax}</g>`;

  // the stamped well and its ring
  s += `<circle cx="${WELL.x}" cy="${WELL.y}" r="${WELL.r}" fill="${grey(WELL.floor)}"/>`;
  s += `<circle cx="${WELL.x}" cy="${WELL.y}" r="${WELL.r - 3.9}" fill="none" stroke="${grey(WELL.floor + 0.22)}" stroke-width="2"/>`;
  return { defs, s };
}

// ---- the rose ------------------------------------------------------------------------------
//
// A bloom seen from a little above and in front, on a short stem with two leaves. It is
// modelled the way a die sinker cuts it: every petal a small pillow of wax, parted from its
// neighbours by a fine groove.

/** The heart of the bloom; how far the view from above squashes it; and the size and place of the whole rose in the well. */
const ROSE = { x: 69.6, y: 57.4, squash: 0.84, size: 1.07, pivot: [69.2, 72.5], lift: 1.6 };

// Each petal is seen from above: `at` the way it faces (degrees clockwise from east), `r` how
// far its rim stands out, `span` half its sweep, `tip` how pointed its rim is and `lean` where
// along the rim the point sits, `h` the height of its crown, `drop` the height of its rounded
// shoulder, `lip` the width of the edge it rolls back and `roll` how far along the rim that
// runs, `dx`/`dy` where its foot is. Later petals lie over earlier ones. The petals towards
// the viewer are longer and roll back further; each ring inwards stands a little further back.
const PETALS = [
  // the outer five, in the order a rose folds them: two wholly outside, two wholly inside
  { at: 270, r: 14.8, span: 58, tip: 0.07, lean: 0.18, h: 0.5, drop: 0.16, lip: 1.1, roll: 0.4, dx: 0, dy: 0 },
  { at: 54, r: 18.6, span: 62, tip: 0.09, lean: -0.2, h: 0.51, drop: 0.16, lip: 2.2, roll: 0.55, dx: 0, dy: 0 },
  { at: 198, r: 16.8, span: 60, tip: 0.08, lean: 0.15, h: 0.52, drop: 0.16, lip: 1.6, roll: 0.5, dx: 0, dy: 0 },
  { at: 342, r: 16.4, span: 58, tip: 0.07, lean: -0.12, h: 0.53, drop: 0.16, lip: 1.5, roll: 0.5, dx: 0, dy: 0 },
  { at: 126, r: 18.8, span: 64, tip: 0.1, lean: 0.2, h: 0.54, drop: 0.16, lip: 2.4, roll: 0.58, dx: 0, dy: 0 },
  // the second five, set in the gaps of the first
  { at: 234, r: 11.2, span: 60, tip: 0.05, lean: 0.12, h: 0.63, drop: 0.15, lip: 0, roll: 0, dx: 0.2, dy: -1.7 },
  { at: 18, r: 12.2, span: 62, tip: 0.05, lean: -0.15, h: 0.64, drop: 0.15, lip: 0, roll: 0, dx: 0.2, dy: -1.7 },
  { at: 162, r: 12.6, span: 62, tip: 0.06, lean: 0.15, h: 0.65, drop: 0.15, lip: 1.3, roll: 0.5, dx: 0.2, dy: -1.7 },
  { at: 306, r: 10.8, span: 60, tip: 0.04, lean: 0, h: 0.66, drop: 0.15, lip: 0, roll: 0, dx: 0.2, dy: -1.7 },
  { at: 90, r: 13.4, span: 66, tip: 0.06, lean: -0.15, h: 0.67, drop: 0.15, lip: 1.6, roll: 0.5, dx: 0.2, dy: -1.7 },
  // the inner petals, wrapping the bud
  { at: 290, r: 7.4, span: 78, tip: 0.03, lean: 0, h: 0.75, drop: 0.13, lip: 0, roll: 0, dx: 0.3, dy: -3 },
  { at: 67, r: 8.3, span: 78, tip: 0.03, lean: 0, h: 0.77, drop: 0.13, lip: 0, roll: 0, dx: 0.3, dy: -3 },
  { at: 204, r: 7.6, span: 80, tip: 0.03, lean: 0, h: 0.79, drop: 0.13, lip: 0, roll: 0, dx: 0.3, dy: -3 },
];
/** The bud at the heart: a knob with a ribbon of petal wound round on it. */
const BUD = { x: 0.4, y: -3.7, r: 5.3, h: 0.82, drop: 0.12, from: 200, turns: 1.3, start: 0.7, pitch: 2.9, width: 1.8, crown: 0.96 };

/** How far the rim of a petal stands out, u running from -1 to 1 along its sweep. */
const rimRadius = (p, u) => {
  const point = Math.max(0, 1 - Math.abs(u - p.lean) / 0.5) ** 2;
  return p.r * (1 - 0.45 * Math.abs(u) ** 2.6) * (1 + p.tip * point);
};

/** How wide a leaf is along its length (0 at both ends, fullest a third of the way up), as a share of its greatest half-width. */
const leafWidth = (t) => (t ** 0.55 * (1 - t) ** 0.95) / 0.373;
/** The saw teeth of a rose leaf: each rises gently and drops sharply, pointing at the tip. */
const teeth = (t) => (t < 0.1 || t > 0.94 ? 0 : ((t * 8.5) % 1) - 0.5);

function rose({ f, grey, cubic, taper, almond }) {
  let defs = '';
  let s = '';
  const F = WELL.floor;

  // a pillow: nothing at the edge of a shape, swelling to full height a little way in
  defs += edgeFilter('seal-pillow', 1.0, (d) => 1 - Math.exp(-d / 1.2));
  // a groove: a line that sinks whatever lies under it by a share of its height
  const groove = (d, depth, width) =>
    `<path d="${d}" fill="none" stroke="#000" stroke-opacity="${depth}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const line = (pts) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`;

  const stem = cubic([ROSE.x + 0.4, ROSE.y + 11], [ROSE.x + 2.4, ROSE.y + 21], [ROSE.x - 3.4, ROSE.y + 31], [ROSE.x - 3.6, ROSE.y + 43]);

  // a leaf: a saw-edged blade swelling either side of a sunk midrib, with veins cut into it
  const leaf = (id, from, deg, length, half, bend) => {
    const c = Math.cos(rad(deg));
    const sn = Math.sin(rad(deg));
    const along = (d, off) => [from[0] + c * d - sn * off, from[1] + sn * d + c * off];
    const rib = cubic(from, along(length * 0.35, bend * length), along(length * 0.72, bend * length * 0.9), along(length, 0));
    const n = 68;
    const side = (sign) => {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const [x, y] = rib.at(t);
        const a = rib.heading(t) + (sign * Math.PI) / 2;
        const w = half * leafWidth(t) * (1 + 0.16 * teeth(t));
        pts.push([x + Math.cos(a) * w, y + Math.sin(a) * w]);
      }
      return pts;
    };
    const blade = poly([...side(1), ...side(-1).reverse()], f);
    const out = `<path d="${blade}" fill="${grey(F + 0.09)}"/><path d="${blade}" fill="${grey(F + 0.28)}" filter="url(#seal-pillow)"/>`;
    // the veins: grooves running out from the midrib towards the tip
    let cuts = '';
    for (let i = 0; i < 4; i++) {
      const t = 0.2 + i * 0.165;
      const [x, y] = rib.at(t);
      for (const sign of [1, -1]) {
        const lean = rad(50 - i * 4);
        const a = rib.heading(t) + sign * lean;
        const far = (half * leafWidth(t) * 0.92) / Math.sin(lean);
        const b = rib.heading(t) + sign * rad(28);
        cuts += groove(
          `M${f(x)} ${f(y)}Q${f(x + Math.cos(b) * far * 0.55)} ${f(y + Math.sin(b) * far * 0.55)} ${f(x + Math.cos(a) * far)} ${f(y + Math.sin(a) * far)}`,
          0.3,
          0.7,
        );
      }
    }
    // the midrib, cut deepest at the stalk
    cuts += `<path d="${taper(rib, (t) => 1.2 - 0.75 * t, 24)}" fill="#000" fill-opacity="0.5"/>`;
    defs += `<clipPath id="seal-${id}"><path d="${blade}"/></clipPath>`;
    return `${out}<g clip-path="url(#seal-${id})">${cuts}</g>`;
  };

  // the two leaves, each on a short stalk
  const leaves = [
    { id: 'leaf-r', on: 0.52, stalk: [3.2, -1.2], deg: -24, length: 20, half: 5.4, bend: -0.1 },
    { id: 'leaf-l', on: 0.72, stalk: [-3, -1], deg: 204, length: 19, half: 5.1, bend: 0.1 },
  ];
  for (const l of leaves) {
    const [x, y] = stem.at(l.on);
    const from = [x + l.stalk[0], y + l.stalk[1]];
    s += `<path d="M${f(x)} ${f(y)}L${f(from[0])} ${f(from[1])}" stroke="${grey(F + 0.17)}" stroke-width="1.4" stroke-linecap="round"/>`;
    s += leaf(l.id, from, l.deg, l.length, l.half, l.bend);
  }

  // the stem, a rounded cord that thickens downwards and is cut on the slant, with two thorns
  for (const [on, sign] of [
    [0.3, -1],
    [0.86, 1],
  ]) {
    const [x, y] = stem.at(on);
    const a = stem.heading(on);
    const out = a - (sign * Math.PI) / 2;
    const pts = [
      [x + Math.cos(a) * 1.3, y + Math.sin(a) * 1.3],
      [x + Math.cos(out) * 2.9 - Math.cos(a) * 0.9, y + Math.sin(out) * 2.9 - Math.sin(a) * 0.9],
      [x - Math.cos(a) * 1.3, y - Math.sin(a) * 1.3],
    ];
    s += `<path d="${poly(pts, f)}" fill="${grey(F + 0.2)}"/>`;
  }
  const cord = (width, slant) => {
    const left = [];
    const right = [];
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const [x, y] = stem.at(t);
      const a = stem.heading(t);
      const w = width(t) / 2;
      // the cut: one side of the cord runs on a little further than the other
      const on = i === n ? slant : 0;
      left.push([x + Math.cos(a + Math.PI / 2) * w - Math.cos(a) * on, y + Math.sin(a + Math.PI / 2) * w - Math.sin(a) * on]);
      right.push([x - Math.cos(a + Math.PI / 2) * w + Math.cos(a) * on, y - Math.sin(a + Math.PI / 2) * w + Math.sin(a) * on]);
    }
    return poly([...left, ...right.reverse()], f);
  };
  s += `<path d="${cord((t) => 2.3 + 0.6 * t, 0.9)}" fill="${grey(F + 0.14)}"/>`;
  s += `<path d="${cord((t) => 1 + 0.3 * t, 0.4)}" fill="${grey(F + 0.27)}"/>`;

  // the sepals, curling down from under the bloom either side of the stem
  s += `<path d="${almond(ROSE.x + 0.1, ROSE.y + 13, rad(124), 6.6, 1.5, 0.45)}" fill="${grey(F + 0.2)}"/>`;
  s += `<path d="${almond(ROSE.x + 0.9, ROSE.y + 13, rad(54), 6, 1.4, 0.45)}" fill="${grey(F + 0.2)}"/>`;

  // the bloom
  let bloom = '';
  let silhouette = '';
  const shells = PETALS.map((p) => {
    const at = (u, inset = 0) => {
      const a = rad(p.at + u * p.span);
      const r = rimRadius(p, u) - inset;
      return [Math.cos(a) * r, Math.sin(a) * r];
    };
    const rim = [];
    const n = 40;
    for (let i = 0; i <= n; i++) rim.push(at(-1 + (2 * i) / n));
    // the rolled edge: a sliver along the rim, widest at the point
    const outer = [];
    const inner = [];
    for (let i = 0; i <= n; i++) {
      const v = -1 + (2 * i) / n;
      const u = clamp(p.lean + v * p.roll, -1, 1);
      outer.push(at(u));
      inner.push(at(u, p.lip * (1 - v * v) ** 1.1));
    }
    const place = `transform="translate(${f(p.dx)} ${f(p.dy)}) scale(1 ${ROSE.squash})"`;
    const d = poly([[0, 0], ...rim], f);
    silhouette += `<path d="${d}" ${place}/>`;
    return { p, d, place, fold: line(inner), roll: poly([...outer, ...inner.reverse()], f) };
  });
  defs += `<clipPath id="seal-bloom">${silhouette}</clipPath>`;
  for (const { p, d, place, fold, roll } of shells) {
    // the groove a petal presses into the petals under it, then the petal itself
    bloom += `<g clip-path="url(#seal-bloom)"><g ${place}>${groove(d, 0.26, 2.2)}</g></g>`;
    bloom += `<g ${place}><path d="${d}" fill="${grey(p.h - p.drop)}"/><path d="${d}" fill="${grey(p.h)}" filter="url(#seal-pillow)"/>`;
    if (p.lip) bloom += `${groove(fold, 0.3, 1)}<path d="${roll}" fill="${grey(p.h + 0.05)}"/>`;
    bloom += `</g>`;
  }
  // the bud: a knob, and a ribbon of petal wound round on it
  {
    const place = `transform="translate(${BUD.x} ${BUD.y}) scale(1 ${ROSE.squash})"`;
    const knob = `<circle r="${BUD.r}"`;
    bloom += `<g ${place}>${knob} fill="none" stroke="#000" stroke-opacity="0.26" stroke-width="2.2"/>`;
    bloom += `${knob} fill="${grey(BUD.h - BUD.drop)}"/>${knob} fill="${grey(BUD.h)}" filter="url(#seal-pillow)"/>`;
    const outer = [];
    const inner = [];
    const n = 72;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = rad(BUD.from) + t * BUD.turns * TAU;
      const mid = BUD.start + BUD.pitch * t * BUD.turns;
      const w = BUD.width * Math.min(1, (1 - t) / 0.2) ** 0.7;
      outer.push([Math.cos(a) * (mid + w / 2), Math.sin(a) * (mid + w / 2)]);
      inner.push([Math.cos(a) * Math.max(0, mid - w / 2), Math.sin(a) * Math.max(0, mid - w / 2)]);
    }
    bloom += `<path d="${poly([...outer, ...inner.reverse()], f)}" fill="${grey(BUD.crown)}"/></g>`;
  }
  s += `<g transform="translate(${ROSE.x} ${ROSE.y})">${bloom}</g>`;
  // the whole rose, sized to sit well in the well
  const [px, py] = ROSE.pivot;
  s = `<g transform="translate(${px} ${py - ROSE.lift}) scale(${ROSE.size}) translate(${-px} ${-py})">${s}</g>`;
  return { defs, s };
}

// ---- the piece -----------------------------------------------------------------------------

export default {
  name: 'seal',
  width: 140,
  height: 140,
  scale: 3,
  // A crisper press than plain wax, for the fine cutting of the die; a tone curve that keeps
  // the lit side a rich red and lets a little light into the shade, as wax does; and a small,
  // bright glint in place of the broad sheen, which showed the grain of the press.
  material: {
    base: 'wax',
    soften: 0.65,
    depth: 4,
    lift: 0.1,
    curve: [0.19, 0.27, 0.34, 0.42, 0.5, 0.59, 0.67, 0.74, 0.8],
    gloss: { constant: 1.7, exponent: 85, elevation: 53, gain: 0.92 },
  },
  draw(ctx) {
    const p = pool(ctx);
    const r = rose(ctx);
    return `<defs>${p.defs}${r.defs}</defs>${p.s}${r.s}`;
  },
  /** The silhouette of the pool, a hair outside its outline so the roll of the edge is whole. */
  mask({ f }) {
    return `<path d="${closed(poolPoints(() => -0.4), f)}" fill="#fff"/>`;
  },
};
