// The bow tied on the band: two full loops gathered into a small wrapped knot, and two tails
// falling to the bottom left and bottom right with swallow-tail ends.
//
// For placing it: the knot is centred on (150, 80) and is about 23 x 30. The loops reach from
// x = 40 to x = 257 and from y = 35 to y = 110; the tails end at y = 197 (left) and y = 190 (right).
// Nothing touches the edge of the 300 x 210 picture. Set the knot on the band's centre line, over
// the place where the band is cut.
import {
  SATIN,
  UNIT,
  createField,
  addPatch,
  castShadows,
  extendEdges,
  soften,
  fieldImage,
  pathOf,
  spline,
  lerp,
  clamp,
  smooth,
  gauss,
} from './_cloth.mjs';

const WIDTH = 300;
const HEIGHT = 210;
const KNOT = [150, 80];

const rad = (d) => (d * Math.PI) / 180;

/** The woven selvedge, d px in from the ribbon's edge: a hair proud of the satin, with a faint line inside it. */
const selvedgeLine = (d) => 0.042 * gauss(d - 1.2, 1.1) - 0.022 * gauss(d - 3.6, 1.3);

/** A gently bending axis: local (along, across) to the page. Negative `across` is the upper side. */
function frame(origin, heading, turn, side, size) {
  return ([s0, n0]) => {
    const s = s0 * size;
    const n = n0 * size;
    const th = heading + turn * s;
    const x = origin[0] + (Math.sin(th) - Math.sin(heading)) / turn;
    const y = origin[1] - (Math.cos(th) - Math.cos(heading)) / turn;
    return [x - Math.sin(th) * n * side, y + Math.cos(th) * n * side];
  };
}

// One loop, drawn along its own axis from the knot (0) to the far fold (106). Across, negative is up.
const LOOP = (() => {
  // where the ribbon turns back on itself: the far selvedge and the lip of the opening meet here
  const turn = [105.5, -4];
  // the far selvedge of the back of the loop: the loop's upper outline
  const selvedge = spline([[0, -7.5], [8, -13.5], [21, -25.5], [41, -36], [64, -41], [84, -37.5], [97, -27.5], [103.5, -15], turn]);
  // the lower selvedge, round the far fold and up to the turn
  const under = spline([[0, 8], [12, 11.5], [28, 17], [48, 24], [68, 29.5], [85, 29], [97, 22.5], [104, 12.5], [106.3, 2], turn]);
  // the lip of the opening: the near selvedge of the front of the loop
  const lipPts = [[0, -6.5], [12, -10.5], [30, -17], [50, -23], [70, -25.5], [86, -25], [98, -18], [104, -8.5], turn];
  const lip = spline(lipPts);
  const inner = spline(lipPts.map(([s, n]) => [s, n + 9])); // a line under the front, for the back to run to
  // how far along the far outline lies at a given height across
  const reach = [];
  for (let n = -42; n <= 32; n += 0.5) {
    const pts = n < -4 ? selvedge.dense : under.dense;
    let far = 0;
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]];
      if (Math.min(a[0], b[0]) > 72 && (a[1] - n) * (b[1] - n) <= 0) {
        far = Math.max(far, lerp(a[0], b[0], (n - a[1]) / (b[1] - a[1] || 1)));
      }
    }
    reach.push(far);
  }
  // the outline is not there above and below its widest points: carry the nearest value on
  for (let i = reach.length >> 1; i >= 0; i--) if (!reach[i]) reach[i] = reach[i + 1];
  for (let i = reach.length >> 1; i < reach.length; i++) if (!reach[i]) reach[i] = reach[i - 1];
  const farEdge = (n) => {
    const t = clamp((n + 42) / 0.5, 0, reach.length - 1.001);
    const i = Math.floor(t);
    return lerp(reach[i], reach[i + 1], t - i);
  };
  return { selvedge, under, lip, inner, farEdge };
})();

/** A point on the front of a loop: [along, across, height]. `gathers` vary from loop to loop. */
function loopFront(u, v, gathers) {
  const a = LOOP.lip.at(u);
  const b = LOOP.under.at(u);
  const s = lerp(a[0], b[0], v);
  const n = lerp(a[1], b[1], v);
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  // the arch of the loop: up out of the knot, over, and down round the far fold, with nothing
  // level in between, so that the light runs across it as it does across a bent ribbon
  const arc = lerp(0.34, 0.9, Math.pow(Math.sin((Math.PI / 2) * clamp(s / 54)), 1.2)) - 0.27 * Math.pow(smooth(46, 106, s), 1.2);
  const roll = Math.sin((Math.PI / 2) * clamp((LOOP.farEdge(n) - s) / 27));
  let z = lerp(0.42, arc, roll);
  // A ribbon is straight across its width, so nothing here rounds the loop from lip to lower
  // edge as a cushion would be rounded; only the two selvedges turn away a very little.
  const settled = smooth(0.04, 0.3, u);
  z -= 0.035 * Math.pow(1 - smooth(0, 5, v * chord), 1.6) * settled;
  z -= 0.1 * Math.pow(1 - smooth(0, 12, (1 - v) * chord), 1.5) * settled;
  // The gathers that run out of the knot: the ribbon is pleated like a fan there, every part of it
  // on one flank of a pleat or the other. Fine pleats close to the knot, and a broader wave under
  // them that carries on down the loop.
  const w = v + gathers.warp * Math.sin(2 * Math.PI * (1.3 * v + gathers.shift)) + gathers.lean * u;
  z += 0.105 * Math.exp(-Math.pow(u / 0.24, 1.3)) * Math.sin(2 * Math.PI * (gathers.fine * w + gathers.p1));
  z += 0.075 * Math.exp(-Math.pow(u / 0.82, 2)) * smooth(1, 0.78, u) * Math.sin(2 * Math.PI * (gathers.broad * w + gathers.p2));
  // and where the knot bites, a few sharp creases that do not get far
  for (const [v0, deep, reach] of gathers.creases) {
    z -= deep * Math.exp(-Math.pow(u / reach, 1.5)) * gauss(v - v0, lerp(0.035, 0.07, clamp(u / reach)));
  }
  // where the loop buckles a little under its own weight
  const al = rad(-33);
  const along = (s - 62) * Math.cos(al) + (n + 1) * Math.sin(al);
  const off = -(s - 62) * Math.sin(al) + (n + 1) * Math.cos(al);
  z -= 0.035 * gauss(off, 7) * gauss(along, 22);
  z += 0.024 * gauss(off - 11, 8) * gauss(along, 24);
  // the selvedges show along the lip and the lower edge, but not round the far fold, which has none
  z += 0.7 * (selvedgeLine(v * chord) * smooth(0.98, 0.8, u) + selvedgeLine((1 - v) * chord) * smooth(0.74, 0.56, u)) * settled;
  return [s, n, z];
}

function loop(field, { origin, heading, turn, side, size = 1, gathers }) {
  const place = frame(origin, heading, turn, side, size);
  const outlines = [];

  // the inside of the loop, seen through the opening: it falls away from its selvedge, slowly
  // at first and then steeply down behind the lip, so that it is darkest where the lip crosses it
  outlines.push(
    addPatch(field, {
      nu: 130,
      nv: 30,
      at(u, v) {
        const a = LOOP.selvedge.at(u);
        const b = LOOP.inner.at(u);
        const p = [lerp(a[0], b[0], v), lerp(a[1], b[1], v)];
        const wide = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const open = Math.pow(Math.sin(Math.PI * clamp(u * 1.02)), 0.5);
        const lipHeight = loopFront(u, 0, gathers)[2];
        const rim = lipHeight + 0.01;
        const t = clamp((v * wide) / Math.max(1, wide - 9));
        let z = rim - 0.37 * open * (0.4 * t + 0.6 * Math.pow(t, 2.2)) + 0.6 * selvedgeLine(v * wide) * open;
        // the back of the loop is gathered into the knot too: one fold of it shows inside
        z -= 0.08 * Math.exp(-Math.pow(u / 0.34, 1.5)) * smooth(0.02, 0.12, u) * gauss(t - 0.42, 0.2);
        return [...place(p), z];
      },
    }),
  );

  // the front of the loop
  outlines.push(
    addPatch(field, {
      nu: 170,
      nv: 64,
      at(u, v) {
        const [s, n, z] = loopFront(u, v, gathers);
        return [...place([s, n]), z];
      },
    }),
  );
  return outlines;
}

/**
 * A tail: a strip along a spine, gathered at the knot, turning softly about its own length.
 * s runs 0..1 down the tail and v 0..1 across it from the outer selvedge. `twist(s)` is the turn in
 * radians (positive lifts the outer selvedge), which narrows the strip as seen from above and tips
 * it by `lift` of its true rise; `shape(s, v)` is the height of the strip before the twist.
 * `notch` is how deep the swallow tail is cut, `skew` how much shorter its inner corner is.
 */
function tail(field, { points, side, width = 44, notch = 17, skew = 0, twist = () => 0, shape, lift = 0.16 }) {
  const spine = spline(points);
  const L = spine.length;
  return addPatch(field, {
    nu: 200,
    nv: 56,
    at(u, v) {
      // the swallow tail: the middle of the ribbon stops short of its two corners,
      // and the inner corner a little short of the outer one
      const cut = v < 0.5 ? notch * 2 * v : lerp(notch, skew, 2 * v - 1);
      const s = u * (1 - cut / L);
      const c = spine.at(s);
      const th = spine.heading(s);
      const phi = twist(s);
      // gathered at the knot, the ribbon only opens to its full width well down the tail
      const full = lerp(10, width, Math.pow(smooth(0, 0.86, s), 0.8));
      const seen = full * Math.cos(phi);
      const off = (v - 0.5) * seen * side;
      let z = shape(s, v) + ((0.5 - v) * full * Math.sin(phi) * lift) / UNIT;
      z += 0.62 * selvedgeLine(Math.min(v, 1 - v) * seen) * smooth(0.06, 0.22, s);
      return [c[0] - Math.sin(th) * off, c[1] + Math.cos(th) * off, z];
    },
  });
}

/**
 * What every tail does: comes down from the knot gathered into folds that open out and die away
 * along its length. `folds` are [place across, depth, how far it runs, sideways drift] for each valley.
 */
function tailBody(s, v, folds) {
  let z = lerp(0.5, 0.3, smooth(0, 0.3, s));
  for (const [v0, deep, run, drift = 0] of folds) {
    z -= deep * Math.exp(-Math.pow(s / run, 1.3)) * gauss(v - (v0 + drift * s), lerp(0.09, 0.17, s));
  }
  return z;
}

function knot(field) {
  const [kx, ky] = KNOT;
  const tiltK = rad(-5);
  return addPatch(field, {
    nu: 26,
    nv: 96,
    at(u, v) {
      const a = v * Math.PI * 2;
      // a rounded barrel, taller than wide
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const r = 1 / Math.pow(Math.pow(Math.abs(ca), 2.6) + Math.pow(Math.abs(sa), 2.6), 1 / 2.6);
      const lx = ca * r * 11.3 * u;
      const ly = sa * r * 14.8 * u;
      const x = kx + lx * Math.cos(tiltK) - ly * Math.sin(tiltK);
      const y = ky + lx * Math.sin(tiltK) + ly * Math.cos(tiltK);
      // round across like the wrap of ribbon it is, and tucking under at top and bottom
      let z = 0.62 + 0.36 * Math.pow(1 - Math.pow(u, 2.4), 0.55) * (1 - 0.12 * Math.pow(Math.abs(ly) / 14.8, 3));
      // the creases of the wrap, leaning a little as the ribbon was pulled through
      z -= 0.13 * gauss(lx + 3.4 - 0.012 * ly * ly - 0.1 * ly, 1.8) * (1 - 0.5 * Math.pow(Math.abs(ly) / 14.8, 2));
      z -= 0.1 * gauss(lx - 3.2 + 0.01 * ly * ly - 0.16 * ly, 1.7) * smooth(-14, -4, ly) * smooth(14.5, 6, ly);
      z -= 0.05 * gauss(lx - 7.4 - 0.1 * ly, 1.4) * smooth(-9, 0, ly) * smooth(12, 4, ly);
      return [x, y, z];
    },
  });
}

function build() {
  const field = createField({ width: WIDTH, height: HEIGHT });
  const outlines = [];
  outlines.push(
    tail(field, {
      points: [[147, 88], [142, 106], [133, 127], [119, 148], [101, 168], [82, 186]],
      side: -1,
      skew: 7,
      lift: 0.24,
      // a soft twist: it leaves the knot turned a little from the light, then turns its face to it
      twist: (s) => rad(16) * gauss(s - 0.33, 0.15) - rad(30) * gauss(s - 0.72, 0.2) * smooth(1, 0.88, s),
      shape(s, v) {
        let z = tailBody(s, v, [
          [0.3, 0.17, 0.5, 0.04],
          [0.68, 0.14, 0.38, -0.03],
        ]);
        z += 0.035 * smooth(0.3, 0.55, s) * smooth(1, 0.8, s) * gauss(v - (0.46 + 0.1 * Math.sin(s * 7)), 0.2);
        z += 0.08 * smooth(0.84, 1, s) * smooth(0.5, 0, v); // the outer point lifts
        return z;
      },
    }),
    tail(field, {
      points: [[153, 88], [158, 106], [166, 126], [178, 146], [193, 164], [209, 179]],
      side: 1,
      width: 42,
      notch: 16,
      skew: 6,
      lift: 0.24,
      // it turns on itself through the middle: seen from above it narrows there and widens again
      twist: (s) => rad(-38) * gauss(s - 0.52, 0.19),
      shape(s, v) {
        let z = tailBody(s, v, [
          [0.33, 0.22, 0.46, -0.03],
          [0.7, 0.18, 0.4, 0.03],
        ]);
        // this tail runs with the light at its end, so it is the rise and fall along it that shows
        z += 0.1 * Math.sin(2 * Math.PI * ((s - 0.42) / 0.62 + 0.2 * (v - 0.5))) * smooth(0.36, 0.56, s) * smooth(1.03, 0.82, s);
        z += 0.07 * smooth(0.84, 1, s) * smooth(0.5, 0, v);
        return z;
      },
    }),
  );
  outlines.push(
    ...loop(field, {
      origin: [146, 80],
      heading: rad(190),
      turn: rad(-22) / 104,
      side: -1,
      gathers: {
        fine: 3.2,
        p1: 0.1,
        broad: 1.45,
        p2: 0.62,
        warp: 0.035,
        shift: 0.2,
        lean: 0.03,
        creases: [
          [0.16, 0.1, 0.16],
          [0.39, 0.13, 0.24],
          [0.61, 0.09, 0.13],
          [0.8, 0.12, 0.2],
        ],
      },
    }),
  );
  outlines.push(
    ...loop(field, {
      origin: [154, 80],
      heading: rad(-8),
      turn: rad(25) / 104,
      side: 1,
      size: 0.97,
      gathers: {
        fine: 2.9,
        p1: 0.4,
        broad: 1.3,
        p2: 0.7,
        warp: 0.045,
        shift: 0.55,
        lean: -0.02,
        creases: [
          [0.22, 0.12, 0.2],
          [0.47, 0.1, 0.15],
          [0.66, 0.13, 0.25],
          [0.86, 0.09, 0.14],
        ],
      },
    }),
  );
  outlines.push(knot(field));
  // the knot shades the loops beside it, and the loops the tails under them
  castShadows(field, { slope: 0.5, strength: 0.9, fan: [0.75, 1, 1.3] });
  extendEdges(field, { fall: (d) => 0.012 * smooth(0, 3, d) });
  soften(field, 0.75);
  return { field, outlines };
}

let built;
const bow = () => (built ??= build());

export default {
  name: 'bow',
  width: WIDTH,
  height: HEIGHT,
  material: SATIN,
  draw() {
    return fieldImage(bow().field);
  },
  mask({ f }) {
    return bow()
      .outlines.map((o) => `<path d="${pathOf(o, f)}" fill="#fff"/>`)
      .join('');
  },
};
