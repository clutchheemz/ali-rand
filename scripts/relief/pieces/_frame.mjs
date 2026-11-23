// The geometry every piece of the arched frame shares. The frame is one moulding of three raised
// lines: a row of beads on the outside, then a fillet, then a fine thread. Because the top, the
// side tile and the bottom all draw it through this file, they meet without a seam.
//
// The outline is the centre line of the bead row. The two inner lines are true parallels of it,
// made by stroking the closed outline at growing widths and keeping only what falls inside.

import { f, grey } from '../kit.mjs';

export const WIDTH = 312;
export const AXIS = WIDTH / 2;
/** Centre line of the bead row on the straight sides. */
export const JAMB = 10;
/** Bead to bead, along the path. */
export const PITCH = 7;
/** Every piece carries its drawing this far past its edges, so the lines are lit as if they ran on. */
export const BLEED = 14;

/**
 * The frame is all hairlines and small beads, and a hairline that runs the way the light falls
 * (down to the right) shows only by the steepness of its two sides. Pressing the frame a quarter
 * deeper than the paper default keeps those stretches readable; the beads are drawn a little
 * lower in return, so they stand no higher than beads elsewhere on the sheet.
 */
export const MATERIAL = { base: 'paper', depth: 4 };

export const BEAD = { r: 2.1, height: 0.9 };

/**
 * The two inner lines: distance inward from the bead row, width, height.
 * Their edges fall on half design pixels (4 to 6.5 and 9.5 to 10.5 from the bead row), which are
 * whole picture pixels on the straight sides. That is what lets the three pieces match to the
 * pixel: an edge that cuts through a pixel is smoothed slightly differently in a picture with a
 * long curved outline than in one with a short straight one.
 */
export const FILLET = { at: 5.25, width: 2.5, height: 1 };
export const THREAD = { at: 10, width: 1, height: 1 };

// ---------------------------------------------------------------------------------------------
// Polylines: every curve is sampled finely, so lengths can be measured and beads set by distance.

export function bezier(p0, p1, p2, p3, n = 260) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push([0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]));
  }
  return pts;
}

/** Part of a circle, angles in degrees measured clockwise on screen from east. */
export function arc(cx, cy, r, a0, a1, n = 80) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/** Strings parts together, each starting where the last one ended. */
export const join = (...parts) => parts.flatMap((part, i) => (i ? part.slice(1) : part));

/** The other half of the frame: the same points across the axis, in the opposite order. */
export const mirror = (pts) => pts.map(([x, y]) => [WIDTH - x, y]).reverse();

export function measure(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const length = cum[cum.length - 1];
  const at = (s) => {
    if (s <= 0) return pts[0];
    if (s >= length) return pts[pts.length - 1];
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const t = (s - cum[lo]) / (cum[hi] - cum[lo]);
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t];
  };
  return { length, at };
}

/** Where the line through p along direction a (degrees) meets the line through q along b. */
export function meet(p, a, q, b) {
  const [ax, ay] = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
  const [bx, by] = [Math.cos((b * Math.PI) / 180), Math.sin((b * Math.PI) / 180)];
  const t = ((q[0] - p[0]) * by - (q[1] - p[1]) * bx) / (ax * by - ay * bx);
  return [p[0] + ax * t, p[1] + ay * t];
}

export const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

/**
 * Bead places along a curve, exactly one PITCH apart measured along it, starting one PITCH from
 * its beginning (where a bead already sits) and stopping at least `clear` short of its end, where
 * the finial is. Returns the places and how far the last one is from the end.
 */
export function strung(pts, clear) {
  const { length, at } = measure(pts);
  const count = Math.floor((length - clear) / PITCH + 1e-6);
  const places = [];
  for (let k = 1; k <= count; k++) places.push(at(k * PITCH));
  return { places, left: length - count * PITCH };
}

// ---------------------------------------------------------------------------------------------
// Drawing

const d = (pts) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;

/**
 * The fillet and the thread: parallels of the closed outline, on its inside only. Each is a wide
 * stroke of the outline with a narrower black stroke laid over it, which leaves a ring; where the
 * outline turns a corner the rings turn it with a sharp mitre.
 * `id` keeps the names in <defs> apart from every other piece on the page.
 */
export function innerLines(id, outline) {
  const ring = (o) =>
    `<use href="#${id}-outline" stroke="${grey(o.height)}" stroke-width="${f(2 * (o.at + o.width / 2))}"/>` +
    `<use href="#${id}-outline" stroke="#000" stroke-width="${f(2 * (o.at - o.width / 2))}"/>`;
  return (
    `<defs><path id="${id}-outline" d="${d(outline)}"/>` +
    `<clipPath id="${id}-inside"><use href="#${id}-outline"/></clipPath></defs>` +
    `<g clip-path="url(#${id}-inside)" fill="none" stroke-linejoin="miter" stroke-miterlimit="12">` +
    `${ring(THREAD)}${ring(FILLET)}</g>`
  );
}

export const bead = ([x, y], r = BEAD.r, height = BEAD.height) =>
  `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${grey(height)}"/>`;

/** A bead and its twin across the axis. */
export const beadPair = ([x, y], r, height) => bead([x, y], r, height) + bead([WIDTH - x, y], r, height);

/**
 * The finial on a point of the frame: a pearl drawn out into a bud.
 *   away    1 or -1: the way, down or up the page, the bud points
 *   r       radius of the pearl, which sits `sink` inside the point
 *   reach   how far the tip stands beyond the point
 */
export function bud([x, y], away, { r, sink, reach, height = 1 }) {
  const cy = y - away * sink;
  const ty = y + away * reach;
  // the straight sides leave the pearl where the tangents from the tip touch it
  const a = Math.acos(r / Math.abs(ty - cy));
  const px = Math.sin(a) * r;
  const py = cy + away * Math.cos(a) * r;
  return (
    `<path d="M${f(x)} ${f(ty)}L${f(x + px)} ${f(py)}A${f(r)} ${f(r)} 0 1 ${away > 0 ? 0 : 1} ${f(x - px)} ${f(py)}Z" ` +
    `fill="${grey(height)}"/>`
  );
}
