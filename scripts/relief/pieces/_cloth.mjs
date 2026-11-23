// Sculpting cloth as a height field.
//
// Folded satin is all smooth, overlapping, swelling surfaces, which flat SVG shapes describe badly.
// So the ribbon pieces are modelled here as a grid of heights (0 = the paper, 1 = the highest
// point), built from surface patches laid over one another, and handed to the renderer as one
// grey <image> inside the piece's SVG: still a height map, only painted pixel by pixel.
//
// The pieces set the material's `soften` to 0 and do their own softening here, before the heights
// are rounded to greys. The renderer's blur works on heights already rounded to 256 steps and
// rounds its own result again, and on slow satin slopes those steps come out of the lighting as
// contour lines. Softened here instead, and rounded with care (see roundField), the same slopes
// come out as clean as eight bits allow.
//
// Lengths are design px unless a name says otherwise. Nothing here is random: the same call
// always gives the same picture.

import zlib from 'node:zlib';

/**
 * The satin both ribbon pieces are pressed from: the renderer's satin, with the softening done
 * here instead (see above), a deeper relief so that broad folds turn in the light and not only
 * their edges, shadows that go a little darker, and a tighter, stronger sheen.
 */
export const SATIN = {
  base: 'satin',
  soften: 0,
  depth: 6,
  curve: [0.1, 0.32, 0.5, 0.7, 0.9],
  gloss: { constant: 1.1, exponent: 11, elevation: 48, gain: 1.25 },
};
/** Design px of height that one whole grey stands for under that satin. */
export const UNIT = 2 * SATIN.depth;

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
/** 0 below a, 1 above b, an S-curve between (a may be greater than b). */
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** A bell of half-width w around 0. */
export const gauss = (x, w) => Math.exp(-(x * x) / (w * w));

/** A curve from closely spaced [x, y] points, walked at even speed: s runs 0..1 by length. */
export function curve(dense) {
  const along = [0];
  for (let i = 1; i < dense.length; i++) {
    along.push(along[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  }
  const length = along[along.length - 1];
  const find = (s) => {
    const target = clamp(s) * length;
    let lo = 0;
    let hi = dense.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (along[mid] <= target) lo = mid;
      else hi = mid;
    }
    const span = along[hi] - along[lo] || 1;
    return [lo, hi, (target - along[lo]) / span];
  };
  const at = (s) => {
    const [lo, hi, w] = find(s);
    return [lerp(dense[lo][0], dense[hi][0], w), lerp(dense[lo][1], dense[hi][1], w)];
  };
  const heading = (s) => {
    const e = 0.004;
    const a = at(Math.max(0, s - e));
    const b = at(Math.min(1, s + e));
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  return { at, heading, length, dense };
}

/** A smooth curve through the given points (centripetal Catmull-Rom). */
export function spline(points, density = 40) {
  const P = points;
  const n = P.length;
  const ext = [
    [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]],
    ...P,
    [2 * P[n - 1][0] - P[n - 2][0], 2 * P[n - 1][1] - P[n - 2][1]],
  ];
  const knot = (a, b) => Math.max(1e-6, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
  const mix = (a, b, ta, tb, t) => {
    const w = (t - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
  };
  const dense = [];
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [ext[i], ext[i + 1], ext[i + 2], ext[i + 3]];
    const t0 = 0;
    const t1 = t0 + knot(p0, p1);
    const t2 = t1 + knot(p1, p2);
    const t3 = t2 + knot(p2, p3);
    for (let k = 0; k < density; k++) {
      const t = t1 + ((t2 - t1) * k) / density;
      const a1 = mix(p0, p1, t0, t1, t);
      const a2 = mix(p1, p2, t1, t2, t);
      const a3 = mix(p2, p3, t2, t3, t);
      const b1 = mix(a1, a2, t0, t2, t);
      const b2 = mix(a2, a3, t1, t3, t);
      dense.push(mix(b1, b2, t1, t2, t));
    }
  }
  dense.push([P[n - 1][0], P[n - 1][1]]);
  return curve(dense);
}

/** An empty field covering the design rectangle from (x0, y0), `scale` picture px per design px. */
export function createField({ x0 = 0, y0 = 0, width, height, scale = 2 }) {
  const W = Math.round(width * scale);
  const H = Math.round(height * scale);
  return { x0, y0, width, height, scale, W, H, z: new Float32Array(W * H), cover: new Uint8Array(W * H) };
}

function triangle(top, W, H, x0, y0, z0, x1, y1, z1, x2, y2, z2) {
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(area) < 1e-9) return;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2) - 0.5));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2) - 0.5));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2) - 0.5));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2) - 0.5));
  const eps = -1e-4;
  for (let py = minY; py <= maxY; py++) {
    const cy = py + 0.5;
    for (let px = minX; px <= maxX; px++) {
      const cx = px + 0.5;
      const w0 = ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy)) / area;
      const w1 = ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < eps || w1 < eps || w2 < eps) continue;
      const z = w0 * z0 + w1 * z1 + w2 * z2;
      const i = py * W + px;
      if (z > top[i]) top[i] = z;
    }
  }
}

/**
 * Lays a surface patch on the field, covering whatever lies under it as cloth covers cloth.
 * `at(u, v)` gives [x, y, height] for u and v from 0 to 1; the patch is drawn as a mesh of
 * nu x nv cells. Returns the patch's outline as [x, y] points, for the silhouette.
 */
export function addPatch(field, { nu = 96, nv = 32, at }) {
  const { W, H, scale, x0, y0 } = field;
  const cols = nu + 1;
  const n = cols * (nv + 1);
  const X = new Float32Array(n);
  const Y = new Float32Array(n);
  const Z = new Float32Array(n);
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const p = at(i / nu, j / nv);
      const k = j * cols + i;
      X[k] = (p[0] - x0) * scale;
      Y[k] = (p[1] - y0) * scale;
      Z[k] = p[2];
    }
  }
  const top = new Float32Array(W * H).fill(-1e9);
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      triangle(top, W, H, X[a], Y[a], Z[a], X[b], Y[b], Z[b], X[c], Y[c], Z[c]);
      triangle(top, W, H, X[b], Y[b], Z[b], X[d], Y[d], Z[d], X[c], Y[c], Z[c]);
    }
  }
  for (let i = 0; i < top.length; i++) {
    if (top[i] < -1e8) continue;
    field.z[i] = top[i];
    field.cover[i] = 1;
  }
  const outline = [];
  for (let i = 0; i <= nu; i++) outline.push(at(i / nu, 0));
  for (let j = 1; j <= nv; j++) outline.push(at(1, j / nv));
  for (let i = nu - 1; i >= 0; i--) outline.push(at(i / nu, 1));
  for (let j = nv - 1; j > 0; j--) outline.push(at(0, j / nv));
  return outline.map((p) => [p[0], p[1]]);
}

/**
 * Lets raised cloth throw its shadow on what lies beside it, away from the light (the light
 * comes from the top left). The material has no cast shadow of its own, so the shadow is put
 * into the height map: wherever the ground would lie in shadow it is filled up to the edge of
 * the shadow, a gentle ramp falling away from the light, which the lighting then renders dark.
 *   slope     how fast the shadow's edge falls: steeper is darker and shorter
 *   strength  0..1, how far the ground is raised toward the shadow's edge
 *   fan       sideways drift per row of the rays; several values soften the shadow's rim
 */
export function castShadows(field, { slope = 0.4, strength = 1, fan = [1] }) {
  const { W, H, z, scale } = field;
  const unit = UNIT * scale; // picture px of height in one whole grey
  const sum = new Float32Array(W * H);
  for (const dx of fan) {
    const S = Float32Array.from(z);
    const fall = (slope * Math.hypot(dx, 1)) / unit;
    for (let y = 1; y < H; y++) {
      const row = y * W;
      const prev = row - W;
      for (let x = 0; x < W; x++) {
        const sx = x - dx;
        const i0 = Math.floor(sx);
        if (i0 < 0) continue;
        const a = S[prev + i0];
        const b = i0 + 1 < W ? S[prev + i0 + 1] : a;
        const cand = a + (b - a) * (sx - i0) - fall;
        if (cand > S[row + x]) S[row + x] = cand;
      }
    }
    for (let i = 0; i < sum.length; i++) sum[i] += S[i];
  }
  for (let i = 0; i < z.length; i++) z[i] += strength * (sum[i] / fan.length - z[i]);
}

/** For every pixel, how far the nearest covered pixel is (picture px) and which one it is. */
function nearestCovered(cover, W, H) {
  const INF = 1e9;
  const gy = new Float32Array(W * H);
  const sy = new Int32Array(W * H);
  for (let x = 0; x < W; x++) {
    let last = -1;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      if (cover[i]) last = y;
      gy[i] = last < 0 ? INF : y - last;
      sy[i] = last;
    }
    last = -1;
    for (let y = H - 1; y >= 0; y--) {
      const i = y * W + x;
      if (cover[i]) last = y;
      if (last >= 0 && last - y < gy[i]) {
        gy[i] = last - y;
        sy[i] = last;
      }
    }
  }
  const dist = new Float32Array(W * H).fill(INF);
  const src = new Int32Array(W * H).fill(-1);
  const v = new Int32Array(W);
  const bound = new Float64Array(W + 1);
  const f = new Float64Array(W);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let k = -1;
    for (let q = 0; q < W; q++) {
      const g = gy[row + q];
      if (g >= INF) continue;
      f[q] = g * g;
      if (k < 0) {
        k = 0;
        v[0] = q;
        bound[0] = -Infinity;
        bound[1] = Infinity;
        continue;
      }
      let s;
      for (;;) {
        const p = v[k];
        s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
        if (s <= bound[k] && k > 0) k--;
        else break;
      }
      k++;
      v[k] = q;
      bound[k] = s;
      bound[k + 1] = Infinity;
    }
    if (k < 0) continue;
    let j = 0;
    for (let q = 0; q < W; q++) {
      while (bound[j + 1] < q) j++;
      const p = v[j];
      dist[row + q] = Math.sqrt((q - p) * (q - p) + f[p]);
      src[row + q] = sy[row + p] * W + p;
    }
  }
  return { dist, src };
}

/**
 * Carries the cloth's surface on beyond its own edge, so that the edge of the silhouette is lit
 * as a soft turn of the cloth and not as a cliff down to the paper. `fall(d)` is how much lower
 * the surface is d design px outside the edge. Further out than `reach`, where nothing can show
 * through the silhouette any more, the field settles to one level `rest`, which the renderer
 * lights as plain flat grey.
 */
export function extendEdges(field, { fall = () => 0, reach = 7, rest = 0.5 } = {}) {
  const { W, H, z, cover, scale } = field;
  const { dist, src } = nearestCovered(cover, W, H);
  for (let i = 0; i < z.length; i++) {
    if (cover[i]) continue;
    if (src[i] < 0) {
      z[i] = rest;
      continue;
    }
    const d = dist[i] / scale;
    z[i] = lerp(Math.max(0, z[src[i]] - fall(d)), rest, smooth(reach, reach + 14, d));
  }
}

/** Softens the whole field: a Gaussian blur of `sigma` design px. */
export function soften(field, sigma) {
  const { W, H, z, scale } = field;
  const s = sigma * scale;
  const r = Math.max(1, Math.ceil(s * 3));
  const kernel = new Float32Array(2 * r + 1);
  let total = 0;
  for (let i = -r; i <= r; i++) total += kernel[i + r] = Math.exp(-(i * i) / (2 * s * s));
  for (let i = 0; i < kernel.length; i++) kernel[i] /= total;
  const tmp = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += kernel[i + r] * z[y * W + clamp(x + i, 0, W - 1)];
      tmp[y * W + x] = acc;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += kernel[i + r] * tmp[clamp(y + i, 0, H - 1) * W + x];
      z[y * W + x] = acc;
    }
  }
}

function png(W, H, bytes) {
  const raw = Buffer.alloc((W + 1) * H);
  for (let y = 0; y < H; y++) bytes.copy(raw, y * (W + 1) + 1, y * W, (y + 1) * W);
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// thresholds of the 2 x 2 dither: quarter greys that the renderer's slope kernel reads as flat
const DITHER = [0.125, 0.625, 0.875, 0.375];

/**
 * Rounds the heights to the 256 greys a picture can hold, choosing the rounding so that the
 * slopes the renderer will measure (with its 3 x 3 Sobel kernel) stay as close as can be to the
 * true slopes. It starts from a 2 x 2 dither and then nudges single pixels a grey up or down
 * wherever that brings the measured slopes nearer the truth. Returns the greys and, for the
 * curious, the root-mean-square slope error in greys before and after the nudging.
 */
export function roundField(field, sweeps = 12) {
  const { W, H, z } = field;
  const n = W * H;
  const q = new Uint8Array(n);
  const e = new Float32Array(n); // rounded minus true, in greys
  let seed = 7;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = clamp(z[i]) * 255;
      // a whisper of noise, so that where a slow slope passes from one dither pattern to the
      // next it does so in a scatter of pixels and not along a line the light would pick out
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const noise = (seed / 4294967296 - 0.5) * 0.25;
      q[i] = clamp(Math.floor(t + DITHER[(y & 1) * 2 + (x & 1)] + noise), 0, 255);
      e[i] = q[i] - t;
    }
  }
  // what the Sobel kernels make of the rounding error
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  const measure = () => {
    let sum = 0;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        sx[i] = e[i - W + 1] + 2 * e[i + 1] + e[i + W + 1] - (e[i - W - 1] + 2 * e[i - 1] + e[i + W - 1]);
        sy[i] = e[i + W - 1] + 2 * e[i + W] + e[i + W + 1] - (e[i - W - 1] + 2 * e[i - W] + e[i - W + 1]);
        sum += sx[i] * sx[i] + sy[i] * sy[i];
      }
    }
    return Math.sqrt(sum / (2 * n)) / 8; // /8: the kernel's gain on a true slope
  };
  const before = measure();
  for (let sweep = 0; sweep < sweeps; sweep++) {
    let changed = 0;
    for (let y = 2; y < H - 2; y++) {
      for (let x = 2; x < W - 2; x++) {
        const i = y * W + x;
        // how the squared slope error would change if this pixel went up one grey
        const g =
          sx[i - 1 - W] + 2 * sx[i - 1] + sx[i - 1 + W] - (sx[i + 1 - W] + 2 * sx[i + 1] + sx[i + 1 + W]) +
          (sy[i - W - 1] + 2 * sy[i - W] + sy[i - W + 1]) - (sy[i + W - 1] + 2 * sy[i + W] + sy[i + W + 1]);
        if (Math.abs(g) <= 12) continue;
        const d = g > 0 ? -1 : 1;
        if (Math.abs(e[i] + d) > 1.25 || q[i] + d < 0 || q[i] + d > 255) continue;
        q[i] += d;
        e[i] += d;
        sx[i - 1 - W] += d;
        sx[i - 1] += 2 * d;
        sx[i - 1 + W] += d;
        sx[i + 1 - W] -= d;
        sx[i + 1] -= 2 * d;
        sx[i + 1 + W] -= d;
        sy[i - W - 1] += d;
        sy[i - W] += 2 * d;
        sy[i - W + 1] += d;
        sy[i + W - 1] -= d;
        sy[i + W] -= 2 * d;
        sy[i + W + 1] -= d;
        changed++;
      }
    }
    if (!changed) break;
  }
  return { greys: q, before, after: measure() };
}

/** The field as a grey PNG. */
export function fieldPng(field) {
  const { greys } = roundField(field);
  return png(field.W, field.H, Buffer.from(greys.buffer, greys.byteOffset, greys.length));
}

/** The field as SVG markup: one <image> placed on the design rectangle it covers. */
export function fieldImage(field) {
  const { x0, y0, width, height } = field;
  return (
    `<image x="${x0}" y="${y0}" width="${width}" height="${height}" preserveAspectRatio="none" ` +
    `href="data:image/png;base64,${fieldPng(field).toString('base64')}"/>`
  );
}

/** A closed outline as path data. */
export const pathOf = (outline, f) => `M${outline.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
