// The arched frame that holds the invitation text. Three pictures stack into a frame of any
// height: frame-top, any number of frame-side tiles, frame-bottom.
//
//   frame-top     straight sides, a cove at each shoulder, a keel arch drawn up to a bud
//   frame-side    28 px of the two straight sides; repeats down the page
//   frame-bottom  the same shoulders turned over and a shallow bracket curve down to a drop
//
// The beads keep one pitch of 7 px along the whole outline, corners and curves included, and the
// pieces meet half way between two beads.
import {
  WIDTH, AXIS, JAMB, PITCH, BLEED, BEAD, MATERIAL,
  bezier, arc, join, mirror, meet, mix, strung, innerLines, beadPair, bud,
} from './_frame.mjs';

const cos = (a) => Math.cos((a * Math.PI) / 180);
const sin = (a) => Math.sin((a * Math.PI) / 180);

/** Radius of the shoulder cove: a quarter circle exactly three bead pitches long. */
const COVE = (3 * PITCH * 2) / Math.PI;

/**
 * One end of the frame. The top and the bottom are the same construction: `up` is -1 where the
 * curve climbs to its point (the top) and 1 where it falls to it (the bottom).
 *
 * From the straight side the outline turns a square corner (the cusp, marked by a larger pearl)
 * into a quarter-circle cove that steps it inward, then runs on, without a break, into an S:
 * a swelling haunch, a point of inflection, and a hollow flick up to the point.
 *
 *   corner    where the straight side ends
 *   boss      radius of the pearl on the cusp
 *   point     where the two halves of the bead row meet
 *   inflect   where the curve changes from swelling to hollow, and `rake` its slope there
 *   tip       the slope at which it arrives at the point
 *   lam, mu   how soon the haunch and the flick turn
 *   taper     sizes of the last beads before the finial, nearest first, as shares of a full bead
 *   finial    the bud on the point, and `clear`, the least room the bead row leaves it
 */
function end(id, E, up) {
  const beads = [[JAMB, E.corner, E.boss]]; // [x, y, radius]
  // the shoulder
  const centre = [JAMB, E.corner + up * COVE];
  const cove = arc(centre[0], centre[1], COVE, -up * 90, 0);
  for (const a of [60, 30, 0]) beads.push([centre[0] + cos(a) * COVE, centre[1] - up * sin(a) * COVE, BEAD.r]);
  // the curve: two cubics that share the tangent at the inflection and are both straight there
  const S = [JAMB + COVE, E.corner + up * COVE];
  const I = E.inflect;
  const P1 = meet(S, 90, I, up * E.rake);
  const Q2 = meet(I, up * E.rake, E.point, up * E.tip);
  const curve = join(bezier(S, P1, mix(P1, I, E.lam), I), bezier(I, mix(I, Q2, E.mu), Q2, E.point));
  // the straight side runs far past the edge that meets the side tile
  const left = join([[JAMB, E.corner - up * 120], [JAMB, E.corner]], cove, curve);
  let s = innerLines(id, join(left, mirror(left)));
  for (let y = E.corner - up * PITCH; Math.abs(y - E.corner) < 80; y -= up * PITCH) beads.push([JAMB, y, BEAD.r]);
  // the bead row keeps its pitch to the end, grows finer as it nears the point, and leaves the
  // point itself to the finial
  const row = strung(curve, E.finial.clear);
  if (process.env.FRAME_DEBUG) console.log(`${id}: ${row.places.length} beads on the curve, the last ${row.left.toFixed(2)} px from the point`);
  row.places.forEach((p, k) => beads.push([...p, BEAD.r * (E.taper[row.places.length - 1 - k] ?? 1)]));
  for (const [x, y, r] of beads) s += beadPair([x, y], r);
  return s + bud(E.point, up, E.finial);
}

// The numbers are tuned so that the last bead of each curve lands about 8 px short of the point.
export const TOP = {
  height: 200, corner: 154.5, boss: 2.7, point: [AXIS, 11],
  inflect: [100, 48.25], rake: 25, tip: 67, lam: 0.6, mu: 0.41,
  taper: [0.72, 0.8, 0.88, 0.95], finial: { clear: 7.6, r: 2.5, sink: 0.5, reach: 4.5 },
};
export const BOTTOM = {
  height: 170, corner: 45.5, boss: 2.7, point: [AXIS, 160],
  inflect: [102, 126.25], rake: 18.5, tip: 50, lam: 0.58, mu: 0.47,
  taper: [0.72, 0.8, 0.88, 0.95], finial: { clear: 7.6, r: 2.5, sink: 0.5, reach: 4.2 },
};
export const SIDE = { height: 4 * PITCH };

export const drawTop = (id = 'frame-top', T = TOP) => end(id, T, -1);
export const drawBottom = (id = 'frame-bottom', B = BOTTOM) => end(id, B, 1);

export function drawSide(id = 'frame-side') {
  // The outline closes in a point far above and below the tile instead of squarely. A square
  // outline is a plain rectangle to the browser, which then smooths the edges of the beads a
  // hair differently than it does in the top and the bottom; a pointed one is drawn like theirs.
  const far = 400;
  const outline = [
    [JAMB, -far], [JAMB, SIDE.height + far], [AXIS, SIDE.height + far + 80],
    [WIDTH - JAMB, SIDE.height + far], [WIDTH - JAMB, -far], [AXIS, -far - 80],
  ];
  let s = innerLines(id, outline);
  for (let y = PITCH / 2 - 4 * PITCH; y < SIDE.height + 4 * PITCH; y += PITCH) s += beadPair([JAMB, y], BEAD.r);
  return s;
}

export default [
  { name: 'frame-top', width: WIDTH, height: TOP.height, bleed: BLEED, material: MATERIAL, draw: () => drawTop() },
  { name: 'frame-side', width: WIDTH, height: SIDE.height, bleed: BLEED, material: MATERIAL, draw: () => drawSide() },
  { name: 'frame-bottom', width: WIDTH, height: BOTTOM.height, bleed: BLEED, material: MATERIAL, draw: () => drawBottom() },
];
