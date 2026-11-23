// The valance as a height field, in the design pixels of the stage (400 wide, the valance being
// its top 100). It is sculpted in front of the tops of the two drapes, which hang 40 px lower
// than the valance starts, so the valance picture carries those tops with it.

import { clamp, mix, sstep, rng, foldSet, folds, cover, over, bead, tassel, rope } from './_field.mjs';
import { makeDrape } from './_drape.mjs';

export const DRAPE_TOP = 40; // where the drapes start on the stage
export const STAGE = 400;

/** Pass null instead of a drape for the valance alone, without the tops of the drapes behind it. */
export function makeValance(drape = makeDrape()) {
  const rnd = rng(9127);
  const ROPE = { y: 6, r: 3.2, pitch: 9 };
  const LINE = 8; // the line the swags hang from, hidden under the rope
  const GATHERS = [40, 144, 256, 360];

  // ---- the swags: nested folds hanging between two gathers; the end ones run off the sides.
  // Each fold is a soft roll: it comes forward as it falls, then turns under into the next.
  const POWER = 2.3; // how square the hang is: 2 = a parabola, more = flatter at the bottom
  const swagFolds = (flip) => {
    const pts = (list) => list.map(([p, v]) => [flip ? 1 - p : p, v]).sort((a, b) => a[0] - b[0]);
    return foldSet(
      rnd,
      [
        { u: 0, v: 0.44, r: 0.5 },
        { u: 0.11, v: 0.34, r: 0.15 },
        { u: 0.25, v: 0.36, r: 0.2, fade: pts([[0, 0], [0.62, 0], [0.86, 1], [1, 1]]), one: 0.62 },
        { u: 0.41, v: 0.36, r: 0.1 },
        { u: 0.6, v: 0.4, r: 0.1, fade: pts([[0, 1], [0.12, 1], [0.34, 0], [1, 0]]), one: 0.76 },
        { u: 0.83, v: 0.5, r: 0.3 },
        { u: 1, v: 0.5, r: 0.3 },
      ],
      [
        { a: 0.5, k: 0.55, f: 1 },
        { a: 0.62, k: 0.55, f: 1 },
        { a: 0.6, k: 0.55, f: 1 },
        { a: 0.72, k: 0.56, f: 1 },
        { a: 0.8, k: 0.58, f: 1 },
        { a: 0.7, k: 0.5, f: 1 },
      ],
      { wander: 0.02, period: [0.5, 1.6], aNoise: 0.05, vNoise: 0.08, kNoise: 0.05 },
    );
  };
  const SWAGS = [
    { x1: -80, x2: 40, drop: 50, lean: 0, at: swagFolds(false) },
    { x1: 40, x2: 144, drop: 56, lean: 0.1, at: swagFolds(false) },
    { x1: 144, x2: 256, drop: 66, lean: 0, at: swagFolds(false) },
    { x1: 256, x2: 360, drop: 56, lean: -0.1, at: swagFolds(true) },
    { x1: 360, x2: 480, drop: 50, lean: 0, at: swagFolds(true) },
  ];
  /** The lower edge of a swag at t (0..1 across it). */
  const hang = (S, t) => LINE + S.drop * (1 - Math.abs(2 * t - 1) ** POWER);

  const swag = (S, X, Y) => {
    const t = (X - S.x1) / (S.x2 - S.x1);
    if (t <= 0.002 || t >= 0.998) return null;
    const q = Math.abs(2 * t - 1);
    const depth = S.drop * (1 - q ** POWER);
    const s = (Y - LINE) / depth; // 0 on the line the swag hangs from, 1 on its lower edge
    if (s < -0.3 || (s - 1) * depth > 1.5) return null;
    const slope = (S.drop * POWER * 2 * q ** (POWER - 1)) / (S.x2 - S.x1);
    const a = cover(((1 - s) * depth) / Math.hypot(1, slope));
    if (a <= 0) return null;
    const sc = clamp(s);
    const f = S.at(t);
    return [a, folds(sc * (1 + S.lean * (2 * t - 1) * (1 - sc)), f.b, f.c, f.A, f.V, f.R, f.F)[0]];
  };

  // ---- the tails: a cascade of three pleats hung over each outer gather, longest at the outside,
  // each cut on the slant. x is measured from the side of the stage, so the right one mirrors the left.
  const PIPES = { b: [25, 36.5, 47.5, 58], hem: [76, 60, 44], axis: 41.5 };
  const pipes = foldSet(
    rnd,
    [
      { u: 25, v: 0.48, r: 0.2 },
      { u: 36.5, v: 0.52, r: 0.15 },
      { u: 47.5, v: 0.58, r: 0.15 },
      { u: 58, v: 0.56, r: 0.2 },
    ],
    [
      { a: 0.8, k: 0.5, f: 0.72 },
      { a: 0.88, k: 0.5, f: 0.72 },
      { a: 0.95, k: 0.5, f: 0.72 },
    ],
    { wander: 0, aNoise: 0, vNoise: 0, kNoise: 0 },
  )(0);
  const tail = (x, Y) => {
    const v = (Y - LINE) / 78;
    if (v < -0.2 || v > 1.12) return null;
    const flare = mix(0.72, 1.06, sstep(0, 1, v)); // gathered at the top, spreading as it falls
    const xs = PIPES.axis + (x - PIPES.axis) / flare;
    if (xs < 24 || xs > 59) return null;
    const i = xs < PIPES.b[1] ? 0 : xs < PIPES.b[2] ? 1 : 2;
    const s = clamp((PIPES.b[i + 1] - xs) / (PIPES.b[i + 1] - PIPES.b[i]));
    const hem = PIPES.hem[i] + 8.5 * s ** 1.15 + 0.9 * Math.sin(Math.PI * s);
    const a = cover(hem - Y) * cover((xs - PIPES.b[0]) * flare) * cover((PIPES.b[3] - xs) * flare);
    if (a <= 0) return null;
    return [a, folds(clamp(xs, PIPES.b[0], PIPES.b[3]), pipes.b, pipes.c, pipes.A, pipes.V, pipes.R, pipes.F)[0]];
  };

  // ---- a row of small beads sewn along the lower edge of each swag
  const BEADS = [];
  const SPACING = 6;
  for (const S of SWAGS) {
    const at = (t) => [S.x1 + t * (S.x2 - S.x1), hang(S, t)];
    for (const dir of [1, -1]) {
      let run = SPACING / 2; // half a step either side of the lowest point
      let prev = at(0.5);
      for (let i = 1; i <= 2000; i++) {
        const p = at(0.5 + (dir * i) / 4000);
        run += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
        if (run >= SPACING) {
          run -= SPACING;
          // just outside the edge, so each bead hangs from it
          const tx = (p[0] - prev[0]) * dir;
          const ty = (p[1] - prev[1]) * dir;
          const len = Math.hypot(tx, ty);
          const x = p[0] - (ty / len) * 1.7;
          const y = p[1] + (tx / len) * 1.7;
          // none where a tail or a tassel hangs in front
          const clear =
            x < 21 ||
            x > STAGE - 21 ||
            (x > 65 && x < STAGE - 65 && Math.abs(x - GATHERS[1]) > 11 && Math.abs(x - GATHERS[2]) > 11);
          if (clear) BEADS.push([x, y]);
        }
        prev = p;
      }
    }
  }

  // ---- a tassel hangs over each inner gather
  const TASSELS = [GATHERS[1], GATHERS[2]].map((x) => ({ x, y: LINE, cord: 4, size: 0.95, high: 0.84 }));

  /** The valance alone at a point: [how much of the point it covers, height x cover]. */
  function own(X, Y) {
    const acc = [0, 0];
    if (Y >= 96) return acc;
    for (const S of SWAGS) {
      if (X > S.x1 && X < S.x2) {
        const r = swag(S, X, Y);
        if (r) over(acc, r[0], r[1]);
      }
    }
    for (const [bx, by] of BEADS) {
      if (Math.abs(X - bx) < 3 && Math.abs(Y - by) < 3) {
        const k = bead(X, Y, bx, by, 1.95, 1.95, 0.36, 0.78);
        if (k) over(acc, k[0], k[1]);
      }
    }
    const tl = tail(X < STAGE / 2 ? X : STAGE - X, Y);
    if (tl) over(acc, tl[0], tl[1]);
    // the band the swags hang from runs off the top; a rope lies along it, knotted at each gather
    if (Y < ROPE.y + 1) over(acc, cover(ROPE.y - Y), 0.48);
    if (Math.abs(Y - ROPE.y) < ROPE.r + 0.5) {
      const r = rope(Y - ROPE.y, X, ROPE.r, ROPE.pitch);
      over(acc, r[0], r[1]);
    }
    for (const T of TASSELS) tassel(acc, T, X, Y);
    for (const g of GATHERS) {
      const k = bead(X, Y, g, ROPE.y + 0.4, 4.4, 4.2, 0.74, 1);
      if (k) over(acc, k[0], k[1]);
    }
    return acc;
  }

  /** The height map: the valance, and behind it (unless left out) the tops of the two drapes. */
  function height(X, Y) {
    let h = 0;
    if (drape) {
      if (X < 130) h = drape.height(X, Y - DRAPE_TOP);
      else if (X > STAGE - 130) h = drape.height(STAGE - X, Y - DRAPE_TOP);
    }
    const acc = own(X, Y);
    return h * (1 - acc[0]) + acc[1];
  }

  /** The silhouette of the valance alone, for cutting it out. */
  const covers = (X, Y) => own(X, Y)[0];

  return { height, covers };
}
