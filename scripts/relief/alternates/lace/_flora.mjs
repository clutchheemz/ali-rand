// Shared botanical drawing for floral set "c": jasmine and orange blossom, drawn like engraved lace.
// Everything here paints HEIGHT (black is the paper, white the highest point), never colour.
//
// The manner: forms are drawn the way a steel die is cut for fine stationery. A leaf or a petal is a
// thin raised rim round a low, softly domed field, with its midrib a second raised line. Under a
// raking light every rim throws one fine shadow, whichever way it faces, so the drawing reads as
// lace instead of as cushions. Only the smallest things (buds, leaflets, pearls) are solid.
//
// The module imports nothing, so the folder can be moved without breaking it.

const TAU = Math.PI * 2;

export const f = (v) => String(Math.round(v * 100) / 100);
export const grey = (v) => {
  const c = Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c},${c},${c})`;
};
export const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pathOf = (pts, close = true) => 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + (close ? 'Z' : '');

/**
 * The paper every piece of this set is pressed into. It is the shared paper with one number
 * changed: the die is cut a little sharper (soften 0.9 instead of 1.1 design px) so that rims and
 * veins a pixel wide stay distinct. Depth, tone curve, lift and cast shadow are the defaults.
 */
export const PAPER = { base: 'paper', soften: 0.9 };

// The heights the whole set is cut to, so every piece comes off the same die.
const RIM = 0.7; // the raised line round a petal
const FIELD = 0.18; // the crown of the low dome inside a petal's rim
const LEAF = { rim: 0.6, field: 0.13, rib: 0.5 }; // leaves are cut a little lighter than flowers
const STEM = 0.68;

/**
 * The light falls from the top left, and every piece is also shown mirrored, so in the drawing's own
 * frame the light can lie along either diagonal. A leaf or bud pointing straight along the light has
 * no slope facing it or turned from it, and would all but vanish. This turns such a direction aside
 * until it stands at least `margin` degrees off both diagonals. `lean` (+1 or -1) says which way to
 * turn when the direction sits exactly on a diagonal.
 */
export function offLight(angle, margin = 20, lean = 1) {
  let d = ((deg(angle) % 180) + 180) % 180;
  for (const axis of [45, 135]) {
    const diff = d - axis;
    if (Math.abs(diff) < margin) {
      const turn = (diff === 0 ? lean : Math.sign(diff)) * margin - diff;
      return angle + rad(turn);
    }
  }
  return angle;
}

// ---------------------------------------------------------------------------------------------
// Curves: every stem is a finely sampled polyline measured by its length.

export class Curve {
  constructor(pts) {
    this.pts = pts;
    this.run = [0];
    for (let i = 1; i < pts.length; i++) {
      this.run.push(this.run[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    this.length = this.run[this.run.length - 1];
  }
  /** The point a fraction u of the way along, with the direction of travel there (radians). */
  locate(u) {
    const { pts, run } = this;
    const s = clamp(u, 0, 1) * this.length;
    let i = 1;
    while (i < pts.length - 1 && run[i] < s) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const k = (s - run[i - 1]) / (run[i] - run[i - 1] || 1);
    const p = pts[Math.max(0, i - 2)];
    const q = pts[Math.min(pts.length - 1, i + 1)];
    return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), a: Math.atan2(q[1] - p[1], q[0] - p[0]) };
  }
  at(u) {
    const p = this.locate(u);
    return [p.x, p.y];
  }
  heading(u) {
    return this.locate(u).a;
  }
  get tip() {
    return this.locate(1);
  }
  /** The fraction along the curve that comes nearest to a place. */
  near(x, y) {
    let best = 0;
    let d = Infinity;
    this.pts.forEach((p, i) => {
      const e = Math.hypot(p[0] - x, p[1] - y);
      if (e < d) {
        d = e;
        best = i;
      }
    });
    return this.run[best] / this.length;
  }
  /** The fraction along the curve at which it crosses a height y (for stems that climb steadily). */
  atY(y) {
    let best = 0;
    let d = Infinity;
    this.pts.forEach((p, i) => {
      const e = Math.abs(p[1] - y);
      if (e < d) {
        d = e;
        best = i;
      }
    });
    return this.run[best] / this.length;
  }
}

/** A smooth curve through hand-placed points (Catmull-Rom). */
export function spline(points, per = 18) {
  const P = [points[0], ...points, points[points.length - 1]];
  const out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    for (let j = 0; j < per; j++) {
      const t = j / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        [0, 1].map(
          (k) =>
            0.5 *
            (2 * p1[k] +
              (-p0[k] + p2[k]) * t +
              (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
              (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
        ),
      );
    }
  }
  out.push(points[points.length - 1]);
  return new Curve(out);
}

/** A cubic Bezier as a Curve. */
export function bez(p0, p1, p2, p3, n = 30) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]));
  }
  return new Curve(out);
}

/**
 * A side shoot leaving `parent` at fraction u. side is +1 for the right hand of the direction of
 * travel, -1 for the left. It leaves at a narrow angle and swings out to its final direction,
 * the way real growth does. Angles are in degrees from the parent's direction.
 */
export function shoot(parent, u, side, len, o = {}) {
  const p = parent.locate(u);
  const leave = o.leave ?? 22;
  const arrive = o.arrive ?? 58;
  const aim = o.aim ?? (leave + arrive) / 2;
  const a0 = p.a + side * rad(leave);
  const a1 = p.a + side * rad(arrive);
  const am = p.a + side * rad(aim);
  const end = [p.x + Math.cos(am) * len, p.y + Math.sin(am) * len];
  const k = len * (o.tension ?? 0.36);
  return bez([p.x, p.y], [p.x + Math.cos(a0) * k, p.y + Math.sin(a0) * k], [end[0] - Math.cos(a1) * k, end[1] - Math.sin(a1) * k], end);
}

/** A curve from one place to another, leaving and arriving at given compass angles (radians). */
export function reach(from, to, a0, a1, tension = 0.36) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const k = len * tension;
  return bez(from, [from[0] + Math.cos(a0) * k, from[1] + Math.sin(a0) * k], [to[0] - Math.cos(a1) * k, to[1] - Math.sin(a1) * k], to);
}

/**
 * A stem that kinks a little at every node, the way a twig does: it bends away from each leaf in
 * turn. Besides being true to life this keeps a stem alive under a raking light, because a stem
 * that happens to run straight along the light casts no shadow at all, while one that sways always
 * turns part of itself across it.
 *   first  px along the stem to the first node;  step  px between nodes
 *   amp    how far the stem swings to each side (px);  side0  the side of the first node (+1 or -1)
 * Returns the new curve, and u(k): where node k lies on it.
 */
export function zigzag(base, { first = 7, step = 9, amp = 1.5, side0 = -1 } = {}) {
  const n = Math.ceil(base.length / 0.6);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const d = (i / n) * base.length;
    const p = base.locate(i / n);
    const fade = Math.min(1, d / first, (base.length - d) / (step * 0.6)); // the ends stay on the line
    const k = amp * side0 * Math.cos((Math.PI * (d - first)) / step) * Math.max(0, fade);
    pts.push([p.x - Math.sin(p.a) * k, p.y + Math.cos(p.a) * k]);
  }
  const curve = new Curve(pts);
  const u = (k) => {
    const i = Math.round(((first + k * step) / base.length) * n);
    return curve.run[Math.min(n, i)] / curve.length;
  };
  return { curve, u, count: Math.floor((base.length - first - step * 0.5) / step) + 1 };
}

/** The outline of a stroke that tapers from w0 to w1 along a curve. */
export function ribbon(c, w0, w1, o = {}) {
  const from = o.from ?? 0;
  const to = o.to ?? 1;
  const steps = o.steps ?? Math.max(6, Math.ceil((c.length * (to - from)) / 1.6));
  const L = [];
  const R = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = c.locate(lerp(from, to, t));
    const hw = lerp(w0, w1, Math.pow(t, o.ease ?? 1)) / 2;
    const nx = -Math.sin(p.a);
    const ny = Math.cos(p.a);
    L.push([p.x + nx * hw, p.y + ny * hw]);
    R.push([p.x - nx * hw, p.y - ny * hw]);
  }
  return pathOf([...L, ...R.reverse()]);
}

// ---------------------------------------------------------------------------------------------
// Blades: the one outline behind leaves, petals and buds. Base at the origin, tip along +x.

function profile(t, belly, qb, qt) {
  const g = Math.pow(t, Math.log(0.5) / Math.log(belly));
  const s = Math.max(0, Math.sin(Math.PI * g));
  return Math.pow(s, g < 0.5 ? qb : qt);
}

/**
 * belly  where the blade is widest (0..1)
 * qb/qt  how the base and the tip close: below 1 blunt and round, above 1 drawn out to a point
 * bend   how far the midrib curves aside
 * skew   makes one half wider than the other
 * from   where along the axis the blade starts (so petals can stand off the centre)
 */
function blade(L, w, o = {}) {
  const { bend = 0, belly = 0.4, qb = 0.8, qt = 1.15, skew = 0, from = 0 } = o;
  const n = o.n ?? Math.max(8, Math.round(L * 1.4));
  const up = [];
  const lo = [];
  const mid = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mx = from + (L - from) * t;
    const my = bend * L * t * t;
    const a = Math.atan(2 * bend * t);
    const hw = w * profile(t, belly, qb, qt);
    mid.push([mx, my]);
    up.push([mx + Math.sin(a) * hw * (1 + skew), my - Math.cos(a) * hw * (1 + skew)]);
    lo.push([mx - Math.sin(a) * hw * (1 - skew), my + Math.cos(a) * hw * (1 - skew)]);
  }
  return { up, lo, mid, outline: [...up, ...lo.slice(0, -1).reverse()] };
}

// ---------------------------------------------------------------------------------------------
// A scene collects defs and layers for one piece and hands back the finished markup.

/**
 * name    the piece's name: every id in the markup starts with it
 * seed    for the small natural variations
 * inside  (x, y) => boolean: where the piece is allowed to draw; foliage that would stray is left out
 */
export function scene(name, seed = 1, inside = () => true) {
  const rnd = rng(seed);
  const defs = new Map();
  const lay = { leaf: [], stem: [], bloom: [], top: [] };
  const taken = [];

  const def = (key, make) => {
    const id = `${name}-${key}`;
    if (!defs.has(id)) defs.set(id, make(id));
    return `url(#${id})`;
  };
  const stops = (list) => list.map(([o, v]) => `<stop offset="${f(o)}" stop-color="${grey(v)}"/>`).join('');
  /** A gradient in the unit square of whatever shape it fills. */
  const radial = (key, list, o = {}) =>
    def(
      key,
      (id) =>
        `<radialGradient id="${id}" cx="${o.cx ?? 0.5}" cy="${o.cy ?? 0.5}" r="${o.r ?? 0.5}"` +
        (o.fx != null ? ` fx="${o.fx}"` : '') +
        (o.fy != null ? ` fy="${o.fy}"` : '') +
        `>${stops(list)}</radialGradient>`,
    );
  const linear = (key, list, o = {}) =>
    def(
      key,
      (id) =>
        `<linearGradient id="${id}" x1="${o.x1 ?? 0}" y1="${o.y1 ?? 0}" x2="${o.x2 ?? 1}" y2="${o.y2 ?? 0}">${stops(list)}</linearGradient>`,
    );
  const place = (x, y, a = 0, extra = '') => `transform="translate(${f(x)} ${f(y)}) rotate(${f(deg(a))})${extra}"`;
  const q = (v) => Math.round(v * 50); // heights are shared in steps of 0.02 so gradients can be reused
  const pearlFill = () => radial('pearl', [[0, 1], [0.6, 0.92], [1, 0.6]]);
  /** A low dome: the field inside a rim. */
  const field = (top = FIELD) => radial(`fld${q(top)}`, [[0, top], [0.55, top * 0.8], [1, top * 0.2]]);
  const rimOf = (h = RIM, w = 1) => `stroke="${grey(h)}" stroke-width="${f(w)}" stroke-linejoin="round"`;
  const solidPetal = () => radial('jas', [[0, 0.42], [0.55, 0.38], [1, 0.16]], { cx: 0.58, r: 0.56 });
  const tiltOf = (t) => (t ? ` rotate(${f(deg(t[0]))}) scale(1 ${f(t[1])}) rotate(${f(-deg(t[0]))})` : '');

  const S = {
    rnd,
    lay,
    inside,

    /** Remembers that a disc is occupied, so later foliage keeps clear of it. */
    claim(x, y, r) {
      taken.push([x, y, r]);
    },
    /** Is a disc clear of everything drawn so far? `own` = [x, y, reach] forgives the stem a leaf grows from. */
    free(x, y, r, gap = 1.2, own = null) {
      return taken.every(([tx, ty, tr, isStem]) => {
        if (isStem && own && Math.hypot(tx - own[0], ty - own[1]) < own[2]) return true;
        return Math.hypot(tx - x, ty - y) > tr + r + gap;
      });
    },

    // ---- stems ----------------------------------------------------------------------------
    stem(curve, w0 = 1.2, w1 = 0.85, h = STEM, o = {}) {
      lay.stem.push(`<path d="${ribbon(curve, w0, w1, o)}" fill="${grey(h)}"/>`);
      if (!o.ghost) {
        const n = Math.ceil(curve.length / 2.5);
        for (let i = 1; i <= n; i++) {
          const p = curve.locate(i / n);
          taken.push([p.x, p.y, 0.5, true]);
        }
      }
      return curve;
    },

    // ---- leaves ---------------------------------------------------------------------------
    /**
     * One leaf from (x, y) pointing along ang. o.w is the half-width.
     * Leaves wide enough are cut as a rim, a field and a midrib; leaflets too small for that are
     * a solid blade with a raised midrib. Returns false if there was no room for it.
     */
    leaf(x, y, ang, L, o = {}) {
      const outlined = o.style ? o.style === 'O' : L >= 12.5;
      if (o.light !== false) ang = offLight(ang, o.margin ?? 25);
      const skew = o.skew ?? (outlined ? (rnd() - 0.5) * 0.22 : 0); // no two leaves quite alike
      const draw = (len) => {
        const w = o.w ? o.w * (len / L) : outlined ? Math.max(3.1, len * 0.24) : len * 0.2;
        const bend = o.bend ?? 0;
        const b = blade(len, w, { bend, belly: o.belly ?? 0.4, skew, qt: o.qt ?? 1.15 });
        // is there room? the half nearest the stem is not tested: it belongs to the stem
        const c = Math.cos(ang);
        const sn = Math.sin(ang);
        const world = ([px, py]) => [x + px * c - py * sn, y + px * sn + py * c];
        const probes = [0.5, 0.72, 0.95].map((t) => world(b.mid[Math.round(t * (b.mid.length - 1))]));
        if (o.force !== true) {
          const own = [x, y, len * 0.9];
          if (!probes.every(([px, py], i) => S.free(px, py, w * [0.8, 0.7, 0.3][i], 1.2, own) && inside(px, py))) return false;
        }
        probes.forEach(([px, py], i) => S.claim(px, py, w * [0.95, 0.8, 0.4][i]));
        S.claim(...world(b.mid[Math.round(0.25 * (b.mid.length - 1))]), w * 0.6);
        const rib = new Curve(b.mid);
        let s = `<g ${place(x, y, ang)}>`;
        if (outlined) {
          s += `<path d="${pathOf(b.outline)}" fill="${field(o.field ?? LEAF.field)}" ${rimOf(o.h ?? LEAF.rim, o.rim ?? 0.95)}/>`;
          s += `<path d="${ribbon(rib, 1.0, 0.6, { from: 0, to: 0.9 })}" fill="${grey(o.rib ?? LEAF.rib)}"/>`;
        } else {
          const h = o.h ?? 0.36;
          s += `<path d="${pathOf(b.outline)}" fill="${radial(`lfC${q(h)}`, [[0, h], [0.6, h * 0.92], [1, h * 0.42]], { cx: 0.45 })}"/>`;
          s += `<path d="${ribbon(rib, 1.0, 0.7, { from: 0, to: 0.96 })}" fill="${grey(0.8)}"/>`;
        }
        lay.leaf.push(s + '</g>');
        return true;
      };
      return draw(L) || draw(L * 0.86);
    },

    /**
     * Leaves along a stem, in opposite pairs (the way jasmine carries them) or alternating.
     * from/to  the stretch of the stem to dress;  n  how many nodes;  L  leaf length at the first node
     * taper    how much smaller the last node's leaves are;  splay  angle off the stem in degrees
     */
    foliage(curve, o = {}) {
      const n = o.n ?? 3;
      const from = o.from ?? 0.25;
      const to = o.to ?? 0.85;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1);
        const p = curve.locate(lerp(from, to, t));
        const L = (o.L ?? 14) * (1 - (o.taper ?? 0.25) * t);
        const sides = o.opposite === false ? [(i + (o.start ?? 0)) % 2 ? 1 : -1] : [-1, 1];
        for (const side of sides) {
          if (o.only && side !== o.only) continue;
          const a = p.a + side * rad((o.splay ?? 48) + (rnd() - 0.5) * 8);
          S.leaf(p.x, p.y, a, L * (0.94 + rnd() * 0.12), { bend: -side * (o.bend ?? 0.1), ...o.leaf });
        }
      }
    },

    /**
     * Dresses a stem with leaves by spacing instead of by count: one node every `gap` px, starting
     * `start` px along and stopping `end` px short of the tip. pairs: false alternates single leaves.
     */
    dress(curve, o = {}) {
      const gap = o.gap ?? 12;
      const first = o.start ?? 7;
      const last = curve.length - (o.end ?? 6);
      const count = Math.max(1, Math.floor((last - first) / gap) + 1);
      const [splay0, splay1] = o.splay ?? [52, 40];
      for (let i = 0; i < count; i++) {
        const d = first + i * gap;
        if (d > last + 0.01) break;
        const t = count === 1 ? 0 : i / (count - 1);
        const p = curve.locate(d / curve.length);
        const L = (o.L ?? 14.5) * (1 - (o.taper ?? 0.12) * t);
        const sides = o.pairs === false ? [(i + (o.first ?? 0)) % 2 ? 1 : -1] : [-1, 1];
        for (const side of sides) {
          if (o.only && side !== o.only) continue;
          const a = p.a + side * rad(lerp(splay0, splay1, t) + (rnd() - 0.5) * 8);
          S.leaf(p.x, p.y, a, L * (0.95 + rnd() * 0.1), { bend: -side * (o.bend ?? 0.1), ...o.leaf });
        }
      }
    },

    /**
     * Dresses a stem from a hand-written list, so the rhythm is composed instead of left to chance.
     * Each item is [u, side, kind, size, stalk, extra]: u the fraction along the stem, side +1 or -1,
     * kind 'leaf' | 'leaflet' | 'orange' | 'jasmine' | 'half' | 'buds' | 'pearls' | 'rosebud',
     * size the leaf length or flower width, stalk how far from the stem a flower's centre stands.
     * Flowers are set first so that the leaves keep clear of them.
     */
    spray(curve, items, o = {}) {
      const splay = o.splay ?? 48;
      const later = [];
      for (const [u, side, kind, size, stalk, extra] of items) {
        const p = curve.locate(u);
        if (kind === 'leaf' || kind === 'leaflet') {
          later.push([p, side, kind, size, extra]);
          continue;
        }
        const a = offLight(p.a + side * rad(extra?.angle ?? splay + 6), 24);
        const len = stalk ?? 9;
        const end = [p.x + Math.cos(a) * len, p.y + Math.sin(a) * len];
        const a1 = a - side * rad(extra?.turn ?? 14); // the stalk turns a little toward the stem's own direction
        const c = reach([p.x, p.y], end, p.a + side * rad(extra?.leave ?? 30), a1, 0.4);
        if (kind === 'orange') S.orange(end[0], end[1], size, extra);
        else if (kind === 'jasmine') S.jasmine(end[0], end[1], size, extra);
        else if (kind === 'half') S.jasmineSide(end[0], end[1], a1, size);
        else if (kind === 'buds') S.budSpray(end[0], end[1], a1, { n: extra?.n ?? 3, bud: size, reach: extra?.reach ?? 5 });
        else if (kind === 'pearls') S.pearlSpray(end[0], end[1], a1, { n: extra?.n ?? 3, r: size, reach: extra?.reach ?? 5 });
        else if (kind === 'rosebud') S.rosebud(end[0], end[1], a1, size, extra);
        else if (kind === 'bud') S.bud(end[0], end[1], a1, size);
        else if (kind === 'trefoil') {
          // a leafy shoot: a pair of leaves and a third at its tip
          const q = c.locate(0.42);
          for (const sd of [-1, 1]) S.leaf(q.x, q.y, q.a + sd * rad(50), size * 0.94, { bend: -sd * 0.1 });
          S.leaf(end[0], end[1], a1, size, {});
        }
        S.stem(c, 0.9, 0.78, 0.62);
      }
      for (const [p, side, kind, size, extra] of later) {
        S.leaf(p.x, p.y, p.a + side * rad(extra?.angle ?? splay), size, { bend: -side * 0.1, style: kind === 'leaflet' ? 'C' : undefined, ...extra });
      }
    },

    /**
     * A filler sprig: a hair stem from (x, y) along ang, carrying small leaflets in pairs and one at
     * its tip (or pearls, with o.pearls). o.curl bends it (radians over its length).
     */
    sprig(x, y, ang, len, o = {}) {
      const curl = o.curl ?? 0.3;
      const end = [x + Math.cos(ang + curl * 0.5) * len, y + Math.sin(ang + curl * 0.5) * len];
      const c = reach([x, y], end, ang, ang + curl, 0.35);
      S.stem(c, 0.95, 0.75, 0.6);
      const pairs = o.pairs ?? 3;
      const L0 = o.L ?? 7;
      for (let i = 0; i < pairs; i++) {
        const t = pairs === 1 ? 0.5 : i / (pairs - 1);
        const p = c.locate(lerp(o.from ?? 0.32, 0.84, t));
        const L = L0 * (1 - 0.28 * t);
        for (const side of [-1, 1]) {
          if (o.only && side !== o.only) continue;
          if (o.pearls) {
            const a = p.a + side * rad(58);
            const e = [p.x + Math.cos(a) * L * 0.62, p.y + Math.sin(a) * L * 0.62];
            if (!S.free(e[0], e[1], 1.4) || !inside(e[0], e[1])) continue;
            lay.stem.push(`<path d="M${f(p.x)} ${f(p.y)}L${f(e[0])} ${f(e[1])}" stroke="${grey(0.55)}" stroke-width="0.85" fill="none"/>`);
            S.pearl(e[0], e[1], 1.45 - 0.3 * t);
          } else {
            S.leaf(p.x, p.y, p.a + side * rad(46 + (rnd() - 0.5) * 8), L, { style: 'C', w: L * 0.2, bend: -side * 0.1 });
          }
        }
      }
      const tip = c.tip;
      if (o.pearls) S.pearl(tip.x, tip.y, 1.5);
      else if (o.tip !== false) S.leaf(tip.x, tip.y, tip.a, L0 * 0.9, { style: 'C', w: L0 * 0.18, force: true });
      return c;
    },

    // ---- jasmine --------------------------------------------------------------------------
    /** An open jasmine star seen from the front. D is its width. o.tilt = [axis, squash] turns it away. */
    jasmine(x, y, D, o = {}) {
      const n = o.petals ?? 5;
      const spin = o.spin ?? rnd() * TAU;
      const R = D / 2;
      let base = `<circle r="${f(R * 0.24)}" fill="${grey(0.26)}"/>`;
      let top = '';
      let keels = '';
      for (let i = 0; i < n; i++) {
        const a = spin + (i / n) * TAU + (rnd() - 0.5) * 0.12;
        const len = R * (0.95 + rnd() * 0.08);
        const b = blade(len, R * 0.185, { from: R * 0.1, belly: 0.48, qb: 0.9, qt: 1.1, bend: 0.14 });
        const d = pathOf(b.outline);
        const tr = `transform="rotate(${f(deg(a))})"`;
        base += `<path d="${d}" ${tr} fill="${grey(0.14)}"/>`;
        top += `<path d="${d}" ${tr} fill="${solidPetal()}" style="mix-blend-mode:lighten"/>`;
        keels += `<path d="${ribbon(new Curve(b.mid), 0.95, 0.6, { from: 0, to: 0.86 })}" ${tr} fill="${grey(0.82)}"/>`;
      }
      const eye = Math.max(1.2, D * 0.07);
      lay.bloom.push(
        `<g ${place(x, y, 0, tiltOf(o.tilt))} style="isolation:isolate">${base}${top}${keels}<circle r="${f(eye)}" fill="${pearlFill()}"/></g>`,
      );
      S.claim(x, y, R);
    },

    /** A jasmine bud: a slender club on its calyx, from (x, y) along ang. */
    bud(x, y, ang, L = 7, o = {}) {
      ang = offLight(ang, 16);
      const w = o.w ?? Math.max(1.2, L * 0.17);
      const d = pathOf(blade(L, w, { belly: 0.62, qb: 1.35, qt: 0.85, bend: o.bend ?? 0 }).outline);
      lay.bloom.push(
        `<g ${place(x, y, ang)}><path d="${d}" fill="${linear('bud', [[0, 0.45], [0.5, 0.75], [1, 0.85]])}"/>` +
          `<circle r="0.9" fill="${grey(0.8)}"/></g>`,
      );
      S.claim(x + Math.cos(ang) * L * 0.35, y + Math.sin(ang) * L * 0.35, w + 0.3);
      S.claim(x + Math.cos(ang) * L * 0.75, y + Math.sin(ang) * L * 0.75, w + 0.3);
    },

    /** A cyme of jasmine buds on hair-thin stalks, from (x, y) pointing along ang. */
    budSpray(x, y, ang, o = {}) {
      const n = o.n ?? 3;
      const reachOut = o.reach ?? 6;
      const size = o.bud ?? 7;
      for (let i = 0; i < n; i++) {
        const k = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1);
        const a = ang + rad(k * (o.spread ?? 36)) + (rnd() - 0.5) * 0.15;
        const len = reachOut * (k === 0 ? 1.2 : 0.9 - Math.abs(k) * 0.08) * (0.9 + rnd() * 0.2);
        const mid = ang + rad(k * (o.spread ?? 36) * 0.4);
        const end = [x + Math.cos(mid) * len * 0.5 + Math.cos(a) * len * 0.5, y + Math.sin(mid) * len * 0.5 + Math.sin(a) * len * 0.5];
        S.stem(reach([x, y], end, mid, a, 0.4), 0.9, 0.8, 0.6);
        S.bud(end[0], end[1], a, size * (k === 0 ? 1 : 0.82) * (0.92 + rnd() * 0.16));
      }
    },

    /**
     * Buds keeping an open flower company: short stalks leaving a stem a little below its tip, one
     * to each side, each ending in a bud. `at` is how far back from the tip they leave, in px.
     */
    companions(curve, o = {}) {
      const back = o.at ?? 9;
      const p = curve.locate(1 - back / curve.length);
      const sides = o.sides ?? [-1, 1];
      sides.forEach((side, i) => {
        const a = p.a + side * rad((o.spread ?? 50) + (rnd() - 0.5) * 10);
        const len = (o.reach ?? 6.5) * (0.9 + rnd() * 0.25) * (i ? 0.85 : 1);
        const mid = p.a + side * rad(22);
        const end = [p.x + Math.cos(mid) * len * 0.45 + Math.cos(a) * len * 0.55, p.y + Math.sin(mid) * len * 0.45 + Math.sin(a) * len * 0.55];
        const tip = [end[0] + Math.cos(a) * 5, end[1] + Math.sin(a) * 5];
        if (!inside(tip[0], tip[1]) || !S.free(tip[0], tip[1], 1.2, 0.8, [p.x, p.y, 6])) return;
        S.stem(reach([p.x, p.y], end, mid, a, 0.4), 0.9, 0.8, 0.6);
        S.bud(end[0], end[1], a, (o.bud ?? 6.5) * (0.9 + rnd() * 0.2));
      });
    },

    /** A half-open jasmine seen from the side: a slender tube opening into a fan of petals. */
    jasmineSide(x, y, ang, L = 14, o = {}) {
      const tube = L * 0.5;
      const pet = L * 0.5;
      let s = `<g ${place(x, y, ang)} style="isolation:isolate">`;
      let base = '';
      let top = '';
      for (const [a, k] of [[-64, 1], [64, 1], [-22, 0.95], [22, 0.95]]) {
        const b = blade(pet * k, pet * 0.21, { belly: 0.52, qb: 0.9, qt: 1.0 });
        const d = pathOf(b.outline);
        const tr = `transform="translate(${f(tube)} 0) rotate(${a})"`;
        base += `<path d="${d}" ${tr} fill="${grey(0.14)}"/>`;
        top += `<path d="${d}" ${tr} fill="${solidPetal()}" style="mix-blend-mode:lighten"/>`;
        top += `<path d="${ribbon(new Curve(b.mid), 0.9, 0.6, { from: 0, to: 0.86 })}" ${tr} fill="${grey(0.8)}"/>`;
      }
      s += base + top;
      s += `<path d="M0 -0.5L${f(tube)} -0.8L${f(tube)} 0.8L0 0.5Z" fill="${grey(0.72)}"/>`;
      s += `<circle r="0.95" fill="${grey(0.8)}"/></g>`;
      lay.bloom.push(s);
      S.claim(x + Math.cos(ang) * (tube + pet * 0.4), y + Math.sin(ang) * (tube + pet * 0.4), pet * 0.9);
      S.claim(x + Math.cos(ang) * tube * 0.5, y + Math.sin(ang) * tube * 0.5, 1.2);
    },

    // ---- orange blossom -------------------------------------------------------------------
    /**
     * An open orange blossom: five waxy petals round a crown of stamens. D is its width.
     * Each petal is a rim round a low field with a short keel; the crown is a ring of pearls.
     */
    orange(x, y, D, o = {}) {
      const n = o.petals ?? 5;
      const spin = o.spin ?? rnd() * TAU;
      const R = D / 2;
      // a flower turned partly away is foreshortened across one axis: o.tilt = [axis, squash].
      // The points are moved, not the group, so the rims keep their weight.
      const [axis, squash] = o.tilt ?? [0, 1];
      const ca = Math.cos(axis);
      const sa = Math.sin(axis);
      const turn = ([px, py]) => {
        const u = px * ca + py * sa;
        const v = (-px * sa + py * ca) * squash;
        return [u * ca - v * sa, u * sa + v * ca];
      };
      const spun = (pts, a) => pts.map(([px, py]) => turn([px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a)]));
      let petals = '';
      for (let i = 0; i < n; i++) {
        const a = spin + (i / n) * TAU + (rnd() - 0.5) * 0.14;
        const len = R * (0.95 + rnd() * 0.08);
        const bend = (rnd() - 0.5) * 0.12;
        // long petals that close to a soft point: a star, not a rosette
        const b = blade(len, R * (D >= 26 ? 0.305 : 0.33) * (0.95 + rnd() * 0.1), { belly: 0.58, qb: 0.95, qt: 0.74, bend });
        petals += `<path d="${pathOf(spun(b.outline, a))}" fill="${field(FIELD + 0.04)}" ${rimOf(RIM, 1)}/>`;
        // a short keel down the middle of each petal, where the flower is big enough to carry it
        if (D >= 26) {
          const keel = spun([[len * 0.38, bend * len * 0.14], [len * 0.72, bend * len * 0.52]], a);
          petals += `<path d="${pathOf(keel, false)}" stroke="${grey(0.46)}" stroke-width="0.9" stroke-linecap="round" fill="none"/>`;
        }
      }
      const ring = Math.max(2.6, R * 0.25);
      const m = Math.max(5, Math.round((TAU * ring) / 3.3));
      let crown = `<path d="${pathOf(spun(Array.from({ length: 24 }, (_, i) => [Math.cos((i / 24) * TAU) * (ring + 1.2), Math.sin((i / 24) * TAU) * (ring + 1.2)]), 0))}" fill="${grey(0.3)}"/>`;
      for (let i = 0; i < m; i++) {
        const a = (i / m) * TAU + spin;
        const [bx, by] = turn([Math.cos(a) * ring, Math.sin(a) * ring]);
        crown += `<circle cx="${f(bx)}" cy="${f(by)}" r="${f(squash < 0.8 ? 1.05 : 1.15)}" fill="${pearlFill()}"/>`;
      }
      if (ring >= 3 && squash >= 0.8) crown += `<circle r="${f(Math.min(1.5, ring - 1.9))}" fill="${pearlFill()}"/>`;
      lay.bloom.push(`<g ${place(x, y)}>${petals}${crown}</g>`);
      S.claim(x, y, R);
    },

    /** A round orange-blossom bud: a pearl. */
    pearl(x, y, r = 1.6) {
      lay.bloom.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${pearlFill()}"/>`);
      S.claim(x, y, r);
    },

    /** Pearls on hair stalks fanning from (x, y) along ang. */
    pearlSpray(x, y, ang, o = {}) {
      const n = o.n ?? 3;
      for (let i = 0; i < n; i++) {
        const k = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1);
        const a = ang + rad(k * (o.spread ?? 32)) + (rnd() - 0.5) * 0.1;
        const len = (o.reach ?? 6) * (k === 0 ? 1.15 : 0.85) * (0.9 + rnd() * 0.2);
        const e = [x + Math.cos(a) * len, y + Math.sin(a) * len];
        if (!inside(e[0], e[1])) continue;
        lay.stem.push(`<path d="M${f(x)} ${f(y)}L${f(e[0])} ${f(e[1])}" stroke="${grey(0.55)}" stroke-width="0.85" fill="none"/>`);
        S.pearl(e[0], e[1], (o.r ?? 1.5) * (k === 0 ? 1 : 0.85));
      }
    },

    // ---- rose -----------------------------------------------------------------------------
    /** A rosebud in profile from (x, y) along ang: two wrapped petals in a calyx of narrow sepals. */
    rosebud(x, y, ang, L = 18, o = {}) {
      const W = o.w ?? L * 0.26;
      const flip = o.flip ? -1 : 1;
      const body = blade(L, W, { belly: 0.42, qb: 0.6, qt: 0.92 });
      let s = `<g ${place(x, y, ang)}>`;
      // the calyx: two narrow sepals flare from under the bud
      for (const side of [-1, 1]) {
        const d = pathOf(blade(L * 0.44, L * 0.07, { belly: 0.4, bend: side * 0.3 }).outline);
        s += `<path d="${d}" transform="translate(${f(L * 0.04)} 0) rotate(${side * 58})" fill="${grey(0.62)}"/>`;
      }
      s += `<path d="${pathOf(body.outline)}" fill="${field(0.28)}" ${rimOf(RIM, 1)}/>`;
      // the one petal edge that shows: from the tip in a slow S across to the side
      s += `<path d="M${f(L * 0.95)} 0C${f(L * 0.76)} ${f(-flip * W * 0.5)} ${f(L * 0.56)} ${f(flip * W * 0.62)} ${f(L * 0.3)} ${f(flip * W * 0.5)}" stroke="${grey(0.62)}" stroke-width="0.95" stroke-linecap="round" fill="none"/>`;
      // the hip the bud sits on
      s += `<ellipse cx="${f(-L * 0.04)}" cy="0" rx="${f(L * 0.1)}" ry="${f(L * 0.095)}" fill="${pearlFill()}"/></g>`;
      lay.bloom.push(s);
      for (const t of [0.25, 0.6, 0.9]) S.claim(x + Math.cos(ang) * L * t, y + Math.sin(ang) * L * t, W * (t > 0.8 ? 0.6 : 1.15));
    },

    /**
     * The layered peony-like rose seen from above: ranks of scalloped petals, each a cup with a
     * raised lip, standing higher toward the heart. R is its radius.
     * o.heart  'boss' for a crown of stamens, 'rose' for petals wound tight
     */
    peony(x, y, R, o = {}) {
      const r = rng(o.seed ?? 5);
      const rot = o.rot ?? 0;
      let s = `<g ${place(x, y)}>`;
      let count = 0;
      /** One tongue-shaped petal between radius r0 and r1, centred on angle th. */
      const petal = (r0, r1, th, half, h, kind) => {
        const m = 24;
        const lean = (r() - 0.5) * 0.3 + (kind.lean ?? 0);
        const notch = kind.notch * (0.5 + r());
        const at = (u) => {
          const phi = th + (u + lean * (1 - u * u)) * half;
          const round = Math.pow(1 - Math.pow(Math.abs(u), kind.square), 1 / kind.square);
          const rr = r0 + (r1 - r0) * round - (r1 - r0) * notch * Math.exp(-((u / 0.16) ** 2)) + (r1 - r0) * kind.ruffle * Math.sin(5 * u + lean * 20) * (1 - u * u);
          return [Math.cos(phi) * rr, Math.sin(phi) * rr];
        };
        const rim = [];
        for (let j = 0; j <= m; j++) rim.push(at(-1 + (2 * j) / m));
        const fill = def(
          `pe${count++}`,
          (gid) =>
            `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${f(r1)}">` +
            stops([[0, h - kind.cup], [r0 / r1, h - kind.cup], [lerp(r0 / r1, 1, 0.72), h - kind.cup * 0.4], [1, h]]) +
            `</radialGradient>`,
        );
        s += `<path d="${pathOf([[0, 0], ...rim])}" fill="${fill}"/>`;
        for (const u of kind.veins ?? []) {
          const uu = u + (r() - 0.5) * 0.1;
          const [x1, y1] = at(uu);
          const d0 = Math.hypot(x1, y1);
          const k0 = (d0 - 2) / d0;
          const k1 = (r0 + (d0 - r0) * 0.25) / d0;
          s += `<path d="M${f(x1 * k0)} ${f(y1 * k0)}L${f(x1 * k1)} ${f(y1 * k1)}" stroke="#fff" stroke-opacity="${o.veinStrength ?? 0.22}" stroke-width="0.85" stroke-linecap="round" fill="none"/>`;
        }
        // the lip: the raised line that draws the petal
        s += `<path d="${pathOf(rim, false)}" stroke="${grey(h + kind.lip)}" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" fill="none"/>`;
      };
      const veins = o.veins === false ? [] : [-0.5, 0, 0.5];
      const lip = o.lip ?? 0.42;
      const [n1, n2, n3] = o.counts ?? [8, 8, 7];
      const jitter = o.jitter ?? 0.25;
      const ranks = [
        // rim radius, inner radius, petals, height of the petal's face at its rim
        { r1: 1.0, r0: 0.6, n: n1, h: 0.2, kind: { square: 2.3, notch: 0.12, ruffle: 0.04, cup: 0.12, lip, veins } },
        { r1: 0.8, r0: 0.44, n: n2, h: 0.3, kind: { square: 2.3, notch: 0.1, ruffle: 0.03, cup: 0.14, lip, veins } },
        { r1: 0.61, r0: 0.3, n: n3, h: 0.4, kind: { square: 2.2, notch: 0.06, ruffle: 0.02, cup: 0.16, lip, veins: o.veins === false ? [] : [0] } },
      ];
      if (o.heart === 'rose') {
        ranks.push({ r1: 0.44, r0: 0.18, n: 4, h: 0.5, wide: 1.75, kind: { square: 2.6, notch: 0, ruffle: 0, cup: 0.18, lip, lean: 0.5 } });
        ranks.push({ r1: 0.27, r0: 0.06, n: 3, h: 0.58, wide: 1.9, kind: { square: 2.6, notch: 0, ruffle: 0, cup: 0.18, lip, lean: 0.6 } });
      } else {
        ranks.push({ r1: 0.43, r0: 0.17, n: 5, h: 0.5, kind: { square: 2.2, notch: 0, ruffle: 0, cup: 0.18, lip } });
      }
      ranks.forEach((k, j) => {
        const start = rot + j * 0.9 + r() * 0.4;
        for (let i = 0; i < k.n; i++) {
          const th = start + (i / k.n) * TAU + (r() - 0.5) * (jitter / k.n) * TAU;
          petal(R * k.r0, R * k.r1 * (0.95 + r() * 0.08), th, (Math.PI / k.n) * ((k.wide ?? 1.22) + r() * 0.12), k.h, k.kind);
        }
      });
      if (o.heart === 'rose') {
        s += `<circle r="1.5" fill="${pearlFill()}"/>`;
      } else {
        // the boss: a ring of stamens round one pearl
        const ring = Math.max(3.3, R * 0.1);
        s += `<circle r="${f(ring + 1.9)}" fill="${grey(0.5)}"/>`;
        const m = Math.max(6, Math.round((TAU * ring) / 3.3));
        for (let i = 0; i < m; i++) {
          const a = (i / m) * TAU + rot;
          s += `<circle cx="${f(Math.cos(a) * ring)}" cy="${f(Math.sin(a) * ring)}" r="1.2" fill="${pearlFill()}"/>`;
        }
        s += `<circle r="1.35" fill="${pearlFill()}"/>`;
      }
      lay.bloom.push(s + '</g>');
      S.claim(x, y, R);
    },

    /** A larger rose leaf: rim, midrib and side veins. */
    roseLeaf(x, y, ang, L, o = {}) {
      const w = o.w ?? L * 0.3;
      const b = blade(L, w, { bend: o.bend ?? 0.06, belly: 0.42, qb: 0.7, qt: 1.05, n: Math.round(L * 1.6) });
      let s = `<g ${place(x, y, ang)}>`;
      s += `<path d="${pathOf(b.outline)}" fill="${field(0.14)}" ${rimOf(0.7, 1.05)}/>`;
      const RIB = 0.62;
      const rib = new Curve(b.mid);
      const pairs = Math.max(3, Math.round(L / 5));
      for (let i = 1; i <= pairs; i++) {
        const t = 0.08 + (i / (pairs + 1)) * 0.8;
        const p = rib.locate(t);
        const out = (w * profile(t, 0.42, 0.7, 1.05) * 0.8) / Math.sin(rad(48));
        for (const side of [-1, 1]) {
          const a = p.a + side * rad(48);
          s += `<path d="M${f(p.x)} ${f(p.y)}L${f(p.x + Math.cos(a) * out)} ${f(p.y + Math.sin(a) * out)}" stroke="${grey(RIB * 0.75)}" stroke-width="0.85" stroke-linecap="round" fill="none"/>`;
        }
      }
      s += `<path d="${ribbon(rib, 1.15, 0.6, { from: 0, to: 0.92 })}" fill="${grey(RIB)}"/></g>`;
      lay.leaf.push(s);
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      for (const t of [0.25, 0.5, 0.75, 0.95]) S.claim(x + c * L * t, y + sn * L * t, w * (t > 0.9 ? 0.4 : 0.9));
    },

    // ---- finishing ------------------------------------------------------------------------
    svg() {
      return (
        `<defs>${[...defs.values()].join('')}</defs>` +
        `<g>${lay.leaf.join('')}</g>` +
        `<g style="mix-blend-mode:lighten">${lay.stem.join('')}</g>` +
        `<g>${lay.bloom.join('')}</g>` +
        `<g>${lay.top.join('')}</g>`
      );
    },
  };
  return S;
}
