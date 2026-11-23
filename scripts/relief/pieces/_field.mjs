// Shared tools for the curtain pieces (the leading underscore keeps the generator from loading
// this file as a piece).
//
// Cloth cannot be drawn well with flat shapes and straight gradients: a fold is a rounded ridge
// whose height changes across it AND along it. So the curtains are sculpted as a height FIELD,
// a function height(x, y), which is sampled into a grey picture and handed to the renderer as
// one <image> inside the piece's SVG markup. Black is paper, white the highest point, exactly
// as for drawn pieces. Only Node's own zlib is used; nothing is installed.

import { deflateSync } from 'node:zlib';

/** Samples per design pixel. The renderer works at 2, so this matches it pixel for pixel. */
export const RES = 2;

/**
 * What the curtains are pressed in: the same ivory sheet as everything else, but deeper than the
 * floral embossing and softer, like plaster relief. (The brief suggested soften 1.5; 1.3 keeps
 * the cloth just as soft, because its softness is in the modelling, while the rope, beads and
 * tassels stay legible.)
 */
export const MATERIAL = { base: 'paper', depth: 4.2, soften: 1.3 };

/** Drawn this far beyond every edge, so cloth that runs off the picture is lit as if it carried on. */
export const BLEED = 24;
/** The whole canvas of a W x H piece, bleed included. */
export const canvas = (W, H) => ({ x: -BLEED, y: -BLEED, width: W + 2 * BLEED, height: H + 2 * BLEED });

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const mix = (a, b, t) => a + (b - a) * t;
/** Smooth step from 0 at a to 1 at b. */
export const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** A bell of width w around c. */
export const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
/** A repeatable random stream (the same one the kit hands to drawn pieces). */
export const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

/** A smooth curve through [t, value] points that never overshoots them. */
export function curve(points) {
  const n = points.length;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const h = [];
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    d[i] = (ys[i + 1] - ys[i]) / h[i];
  }
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] > 0) {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i];
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h[i] * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h[i] * m[i + 1]
    );
  };
}

/** A slow, irregular wave between -1 and 1 with periods between lo and hi. */
export function wave(rnd, lo, hi, n = 3) {
  const terms = [];
  let total = 0;
  for (let k = 0; k < n; k++) {
    const a = 1 / (k + 1);
    total += a;
    terms.push([a, (2 * Math.PI) / mix(lo, hi, rnd()), rnd() * 2 * Math.PI]);
  }
  return (t) => {
    let s = 0;
    for (const [a, w, p] of terms) s += a * Math.sin(t * w + p);
    return s / total;
  };
}

/**
 * The cross-section of one fold, from its crest (s = 0) to its valley (s = 1).
 * `round` 0 gives a creased valley, 1 a rounded one; `full` below 1 fattens the crest.
 */
export const fold = (s, round = 0.3, full = 1) => {
  const c = Math.cos((s * Math.PI) / 2);
  const v = 0.5 + 0.5 * Math.cos(s * Math.PI);
  const p = mix(c, v, round);
  return full === 1 ? p : p ** full;
};

/**
 * A run of folds side by side. b = valley positions (n + 1), c = crest positions (n),
 * A = crest heights (n), V = valley heights (n + 1), R = how rounded each valley is (n + 1),
 * F = how full each crest is (n). Returns [height, how far up the fold 0..1, index].
 */
export function folds(u, b, c, A, V, R, F) {
  const n = c.length;
  let j = 0;
  while (j < n - 1 && u >= b[j + 1]) j++;
  let s;
  let k;
  if (u < c[j]) {
    s = clamp((c[j] - u) / Math.max(1e-6, c[j] - b[j]));
    k = j;
  } else {
    s = clamp((u - c[j]) / Math.max(1e-6, b[j + 1] - c[j]));
    k = j + 1;
  }
  const p = fold(s, R[k], F[j]);
  return [V[k] + (A[j] - V[k]) * p, p, j];
}

/** A value that changes along the cloth: a number, or [position, value] points. */
const along = (v) => (typeof v === 'number' ? () => v : curve(v));

/**
 * A run of folds that lives: its valleys wander, deepen and close as the cloth runs on.
 *   valleys  { u, v, r, fade, one }  u = position across the cloth; v = height (each a number or points
 *            along the cloth); r = 0 sharp crease .. 1 rounded hollow; fade = points along the
 *            cloth, 1 where the valley has closed and its two folds are one; one = that fold's height
 *   crests   { a, k, f }  a = height; k = where between its valleys the crest sits; f = fullness
 * Returns at(p): the folds at position p along the cloth, ready for folds().
 */
export function foldSet(rnd, valleys, crests, { wander = 0.011, period = [150, 420], aNoise = 0.07, vNoise = 0.18, kNoise = 0.08 } = {}) {
  const VS = valleys.map((d) => ({ ...d, u: along(d.u), v: along(d.v), fade: d.fade ? curve(d.fade) : null }));
  const CS = crests.map((d) => ({ ...d, a: along(d.a) }));
  const n = CS.length;
  const [lo, hi] = period;
  const wB = VS.map(() => wave(rnd, lo, hi));
  const wV = VS.map(() => wave(rnd, lo * 0.8, hi * 0.8));
  const wA = CS.map(() => wave(rnd, lo * 0.9, hi * 0.9));
  const wK = CS.map(() => wave(rnd, lo, hi));
  const R = VS.map((d) => d.r ?? 0.3);
  const F = CS.map((d) => d.f ?? 1);
  return (p) => {
    const b = [];
    const c = [];
    const A = [];
    const V = [];
    const fade = VS.map((d) => (d.fade ? d.fade(p) : 0));
    const sway = typeof wander === 'function' ? wander(p) : wander;
    for (let j = 0; j <= n; j++) b[j] = VS[j].u(p) + (j === 0 || j === n ? 0 : sway * wB[j](p));
    for (let j = 0; j < n; j++) {
      let k = clamp(CS[j].k + kNoise * wK[j](p), 0.25, 0.75);
      let a = CS[j].a(p) * (1 + aNoise * wA[j](p));
      // a closing valley draws the crests either side of it together into one
      if (fade[j] > 0) {
        k = mix(k, 0.02, fade[j]);
        a = mix(a, VS[j].one, fade[j]);
      }
      if (fade[j + 1] > 0) {
        k = mix(k, 0.98, fade[j + 1]);
        a = mix(a, VS[j + 1].one, fade[j + 1]);
      }
      c[j] = b[j] + (b[j + 1] - b[j]) * k;
      A[j] = a;
    }
    for (let j = 0; j <= n; j++) {
      V[j] = VS[j].v(p) * (1 + vNoise * wV[j](p));
      if (fade[j] > 0) V[j] = mix(V[j], Math.min(A[j - 1], A[j]), fade[j]);
    }
    return { b, c, A, V, R, F };
  };
}

/** A cubic Bezier flattened to points that carry their distance along the curve. */
export function path(p0, p1, p2, p3, steps = 48) {
  const pts = [];
  let len = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    if (i) len += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
    pts.push([x, y, len]);
  }
  return pts;
}

/** Nearest point of a flattened path: [distance (signed: + to the right of travel), distance along]. */
export function nearest(pts, x, y) {
  let best = Infinity;
  let along = 0;
  let side = 1;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, al] = pts[i];
    const [bx, by, bl] = pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
    const qx = ax + dx * t;
    const qy = ay + dy * t;
    const dist = Math.hypot(x - qx, y - qy);
    if (dist < best) {
      best = dist;
      along = al + (bl - al) * t;
      side = dx * (y - qy) - dy * (x - qx) >= 0 ? 1 : -1;
    }
  }
  return [best * side, along];
}

/** How much of a pixel lies inside an edge that is `d` design px away (positive = inside). */
export const cover = (d) => clamp(0.5 + d * RES);

/**
 * Lays a shape over what has been gathered so far. `acc` is [cover, height x cover]; when all
 * shapes are in, the ground h under them becomes h * (1 - acc[0]) + acc[1].
 */
export const over = (acc, a, z) => {
  if (a <= 0) return;
  acc[1] = acc[1] * (1 - a) + z * a;
  acc[0] = 1 - (1 - acc[0]) * (1 - a);
};

/** A rounded bead, modelled so that it shades across its whole face: [cover, height] or null. */
export function bead(x, y, cx, cy, rx, ry, low, high) {
  const q = Math.hypot((x - cx) / rx, (y - cy) / ry);
  if (q >= 1.25) return null;
  return [cover((1 - q) * Math.min(rx, ry)), low + (high - low) * Math.max(0, 1 - q * q) ** 0.8];
}

/**
 * A tassel: a short cord from (T.x, T.y) of length T.cord, then a round head, a waisted collar
 * and a flared skirt of threads. T.size scales it. Adds itself to `acc`.
 */
export function tassel(acc, T, x, y) {
  const k = T.size ?? 1;
  const dx = (x - T.x) / k;
  const dy = (y - T.y) / k;
  const L = T.cord / k;
  if (dy < -1 || dy > L + 44 || Math.abs(dx) > 10) return;
  const edge = (d) => cover(d * k);
  const hi = T.high ?? 1;
  const ax = Math.abs(dx);
  // the cord
  if (dy < L + 1 && ax < 2.4) over(acc, edge(1.6 - ax) * edge(Math.min(dy, L + 0.6 - dy)), hi * (0.6 + 0.3 * Math.max(0, 1 - (ax / 1.6) ** 2)));
  // the head
  const q = Math.hypot(dx / 4.5, (dy - L - 3.9) / 4.9);
  if (q < 1.2) over(acc, edge((1 - q) * 4.5), hi * (0.6 + 0.4 * Math.max(0, 1 - q * q) ** 0.8));
  // the collar: a ring pinched in under the head
  const c0 = L + 9.2;
  if (dy > c0 - 0.8 && dy < c0 + 3.6 && ax < 4.8) {
    const ring = Math.max(0, 1 - ((dy - c0 - 1.4) / 1.9) ** 2);
    over(acc, edge(4.1 - ax) * edge(Math.min(dy - c0 + 0.3, c0 + 3.1 - dy)), hi * (0.55 + 0.42 * ring * Math.max(0, 1 - (ax / 4.4) ** 2)));
  }
  // the skirt: threads spreading from the collar, cut a little unevenly
  const top = L + 11.8;
  const length = 28;
  const v = (dy - top) / length;
  if (v > -0.05 && v < 1.15) {
    const hw = 3.2 + 4.4 * clamp(v) ** 1.2;
    const s = dx / hw;
    if (Math.abs(s) < 1.15) {
      const groove = bell(s, -0.36, 1.05 / hw) + bell(s, 0.36, 1.05 / hw);
      const bottom = top + length - 2.6 * s * s - 1.3 * (bell(s, -0.36, 0.12) + bell(s, 0.36, 0.12));
      const z = 0.46 + 0.46 * Math.max(0, 1 - s * s) ** 0.85 - 0.4 * groove * sstep(0.02, 0.22, v);
      over(acc, edge(hw - ax) * edge(Math.min(dy - top, bottom - dy)), hi * z);
    }
  }
}

/** A twisted rope seen at distance d from its centre line and `along` it: [cover, height]. */
export function rope(d, along, r, pitch, low = 0.5, high = 1) {
  const tube = Math.max(0, 1 - (d / r) ** 2) ** 0.8;
  const strand = Math.abs(Math.cos((Math.PI * (along + 1.3 * d)) / pitch)) ** 0.6;
  return [cover(r - Math.abs(d)), low + (high - low) * tube * (0.2 + 0.8 * strand)];
}
// ---------------------------------------------------------------- picture out

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
};

/** An 8-bit PNG: grey from `pixels`, or, with `clear` set, white whose opacity comes from `pixels`. */
export function png(width, height, pixels, clear = false) {
  const n = clear ? 2 : 1;
  const stride = width * n + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = pixels[y * width + x];
      if (clear) {
        raw[y * stride + 1 + x * 2] = 255;
        raw[y * stride + 2 + x * 2] = v;
      } else raw[y * stride + 1 + x] = v;
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8; // bits per sample
  head[9] = clear ? 4 : 0; // grey with alpha, or grey
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw, { level: 4 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const sample = ({ x, y, width, height }, field, clear) => {
  const w = Math.round(width * RES);
  const h = Math.round(height * RES);
  const pixels = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    const py = y + (j + 0.5) / RES;
    for (let i = 0; i < w; i++) {
      pixels[j * w + i] = Math.round(clamp(field(x + (i + 0.5) / RES, py)) * 255);
    }
  }
  return (
    `<image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" ` +
    `href="data:image/png;base64,${png(w, h, pixels, clear).toString('base64')}"/>`
  );
};

/**
 * Samples height(x, y) (0 = paper, 1 = highest) over a rectangle of design px and returns it as
 * SVG markup: one <image> that paints the height map.
 */
export const heightMap = (box, field) => sample(box, field, false);

/** The same for a silhouette: cover(x, y) is 1 inside the piece and 0 outside. Painted in white. */
export const silhouette = (box, field) => sample(box, field, true);