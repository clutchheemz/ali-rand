// "vine": the tall flowering stem for the envelope's side flaps (set c: jasmine and orange blossom).
// The l version stands on the left flap with x = 0 at the outer edge of the screen.
import { scene, spline, reach, rad, PAPER } from './_flora.mjs';

// The flap is a triangle, so the drawing lives inside a kite: slender tips, fullness in the middle.
const edge = (y) => (y <= 165 ? 48 + (78 * Math.max(0, y - 4)) / 161 : y <= 360 ? 126 : 126 - (78 * (y - 360)) / 156);
const inside = (x, y) => x >= 6.5 && y >= 6.5 && y <= 513.5 && x <= edge(y) - 2;

export default {
  name: 'vine',
  width: 130,
  height: 520,
  material: PAPER,
  variants: { l: {}, r: { flipX: true } },
  draw() {
    const s = scene('vine', 7, inside);
    // the main stem: a slow S, leaning out into the flap and back
    const main = spline([[16.1, 511.8], [20, 478], [30, 440], [44, 398], [56, 352], [61, 305], [58, 258], [50, 212], [40, 168], [32, 126], [29, 88], [31, 54], [38, 26]]);
    const node = (y) => main.locate(main.atY(y));
    /**
     * A side stem from the main stem at height y to a place. It sets out nearly level and turns up,
     * like the arm of a candelabrum: leave is degrees off the main stem (+ right), arrive a bearing.
     */
    const arm = (y, to, leave, arrive, tension = 0.56) => {
      const n = node(y);
      return reach([n.x, n.y], to, n.a + rad(leave), rad(arrive), tension);
    };

    // --- the five arms that carry open blossoms, largest near the middle
    const A = arm(346, [101, 288], 70, -90);
    const B = arm(418, [22, 381], -70, -92);
    const C = arm(270, [101, 211], 66, -88);
    const D = arm(300, [23, 244], -66, -92);
    const E = arm(158, [62, 118], 60, -84);
    s.orange(101, 284, 38, { spin: 0.4 });
    s.orange(22, 377, 28, { spin: 1.3 });
    s.orange(101, 207, 25, { spin: 2.2, tilt: [rad(25), 0.68] });
    s.jasmine(23, 240, 20, { spin: 0.2 });
    s.jasmine(62, 114, 18, { spin: 1.1 });

    // --- the lesser arms: flowers still opening, and buds
    const F = arm(462, [56, 438], 72, -86);
    const G = arm(404, [100, 364], 80, -60);
    const H = arm(362, [27, 320], -70, -98);
    const I = arm(236, [20, 200], -66, -98);
    const J = arm(208, [80, 162], 62, -84);
    const K = arm(180, [17, 154], -64, -98);
    const M = arm(110, [50, 84], 54, -80);
    s.jasmineSide(56, 438, rad(-84), 13);
    s.jasmineSide(80, 162, rad(-82), 14);
    s.jasmineSide(20, 200, rad(-100), 13);
    s.budSpray(100, 364, rad(-58), { n: 3 });
    s.budSpray(27, 320, rad(-100), { n: 3 });
    s.budSpray(50, 84, rad(-78), { n: 3, bud: 6.5 });
    s.rosebud(17, 155, rad(-98), 15);
    const tip = main.tip;
    s.budSpray(tip.x, tip.y, tip.a, { n: 3, bud: 7 });

    // --- stems: the main one starts fine, swells and thins again toward its tip
    s.stem(main, 0.8, 1.45, undefined, { from: 0, to: 0.04 });
    s.stem(main, 1.45, 0.85, undefined, { from: 0.04, to: 1 });
    for (const c of [A, B, C, D, G]) s.stem(c, 1.15, 0.85, 0.74);
    for (const c of [E, F, H, I, J, K, M]) s.stem(c, 1.05, 0.8, 0.72);

    // --- each arm: first its buds and pearls (side +1 is clockwise of the way it grows), ...
    s.spray(A, [[0.5, 1, 'pearls', 1.5, 9], [0.74, 1, 'buds', 6.5, 7, { n: 2 }]]);
    s.spray(C, [[0.56, 1, 'bud', 7, 9]]);
    s.spray(G, [[0.52, 1, 'pearls', 1.5, 8]]);
    s.spray(E, [[0.68, 1, 'buds', 6, 6, { n: 2 }]]);
    s.spray(B, [[0.6, -1, 'pearls', 1.5, 8]]);
    s.spray(D, [[0.66, 1, 'buds', 6.5, 6, { n: 2 }]]);
    // ... then leaves in turn all the way along, dwindling toward the flower
    for (const [c, end] of [[A, 22], [C, 16], [G, 12], [J, 10], [E, 13], [F, 10], [M, 9]]) {
      s.dress(c, { pairs: false, first: 1, gap: 9.5, start: 8, end, L: 14.5, taper: 0.14 });
    }
    for (const [c, end] of [[B, 18], [D, 14], [H, 10], [I, 10], [K, 9]]) {
      s.dress(c, { pairs: false, first: 0, gap: 9.5, start: 8, end, L: 14.5, taper: 0.14 });
    }

    // --- between the arms: leafy shoots of three, and pearls
    const u = (y) => main.atY(y);
    s.spray(main, [
      [u(384), 1, 'trefoil', 13.5, 13],
      [u(322), -1, 'trefoil', 13.5, 13],
      [u(252), 1, 'trefoil', 13, 12],
      [u(134), 1, 'trefoil', 13, 12],
      [u(72), -1, 'pearls', 1.4, 7],
      [u(438), 1, 'pearls', 1.5, 8],
    ]);

    // --- single leaves on the main stem, opposite the side stems
    for (const [y, side] of [
      [498, 1], [482, -1], [446, -1], [404, -1], [418, 1], [346, -1], [362, 1], [300, 1], [270, -1],
      [236, 1], [208, -1], [180, 1], [158, -1], [110, -1], [90, 1], [52, 1], [42, -1],
    ]) {
      const n = node(y);
      s.leaf(n.x, n.y, n.a + side * rad(46), 14.5, { bend: -side * 0.1 });
    }

    return s.svg();
  },
};
