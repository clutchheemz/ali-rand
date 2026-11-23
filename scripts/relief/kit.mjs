// Small drawing helpers for height maps. A height map is ordinary SVG painted in greys:
// black is the level of the paper, white is as high as the relief goes.

/** A number as short as SVG allows. */
export const f = (v) => String(Math.round(v * 100) / 100);

/** The grey for a height between 0 (paper) and 1 (highest). */
export const grey = (v) => {
  const c = Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c},${c},${c})`;
};

/** A repeatable random stream, so a piece is drawn the same way every time. */
export const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

export const rad = (degrees) => (degrees * Math.PI) / 180;

/** A cubic Bezier curve through four [x, y] points. */
export function cubic(p0, p1, p2, p3) {
  const at = (t) => {
    const u = 1 - t;
    return [0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
  };
  const slope = (t) => {
    const u = 1 - t;
    return [0, 1].map((i) => 3 * u * u * (p1[i] - p0[i]) + 6 * u * t * (p2[i] - p1[i]) + 3 * t * t * (p3[i] - p2[i]));
  };
  /** Direction of travel at t, in radians. */
  const heading = (t) => {
    const [dx, dy] = slope(t);
    return Math.atan2(dy, dx);
  };
  const d = `M${f(p0[0])} ${f(p0[1])}C${f(p1[0])} ${f(p1[1])} ${f(p2[0])} ${f(p2[1])} ${f(p3[0])} ${f(p3[1])}`;
  return { at, slope, heading, d };
}

/**
 * A stroke that changes width along its length, as a closed outline.
 * `curve` is anything with at(t) and heading(t); `width(t)` is the full width at t.
 */
export function taper(curve, width, steps = 24) {
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [x, y] = curve.at(t);
    const a = curve.heading(t) + Math.PI / 2;
    const half = width(t) / 2;
    left.push(`${f(x + Math.cos(a) * half)} ${f(y + Math.sin(a) * half)}`);
    right.push(`${f(x - Math.cos(a) * half)} ${f(y - Math.sin(a) * half)}`);
  }
  return `M${left.join('L')}L${right.reverse().join('L')}Z`;
}

/** An almond leaf from (x, y) pointing along `angle` (radians). `belly` shifts the widest point (0..1). */
export function almond(x, y, angle, length, width, belly = 0.42) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const tx = x + c * length;
  const ty = y + s * length;
  const mx = x + c * length * belly;
  const my = y + s * length * belly;
  return (
    `M${f(x)} ${f(y)}Q${f(mx - s * width)} ${f(my + c * width)} ${f(tx)} ${f(ty)}` +
    `Q${f(mx + s * width)} ${f(my - c * width)} ${f(x)} ${f(y)}Z`
  );
}
