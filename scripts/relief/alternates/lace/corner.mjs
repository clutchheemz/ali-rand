// "corner": the bouquet for the corners of the invitation card (set c).
// tl fills the top left corner: a peony-like rose with jasmine round it, one vine trailing along the
// top edge and one down the left edge. The other corners are mirror images.
import { scene, spline, reach, zigzag, rad, PAPER } from './_flora.mjs';

// The arched frame takes the middle of the card: the bouquet keeps to the corner side of the line
// from (150, 84) to (38, 200); the vines may run on in a band along the top and down the left.
const inside = (x, y) =>
  x >= 6.5 && y >= 6.5 && x <= 183.5 && y <= 293.5 && (1.0357 * x + y < 234 || (y < 77 && x > 90) || (x < 36 && y > 120));

export default {
  name: 'corner',
  width: 190,
  height: 300,
  material: PAPER,
  variants: { tl: {}, tr: { flipX: true }, bl: { flipY: true }, br: { flipX: true, flipY: true } },
  draw() {
    const s = scene('corner', 41, inside);
    const [cx, cy, R] = [70, 76, 34];
    const off = (a, d) => [cx + Math.cos(rad(a)) * d, cy + Math.sin(rad(a)) * d];
    /** A short stem from under the bloom's edge out along a bearing, bending a little as it goes. */
    const ray = (a, to, bendBy = 10) => reach(off(a, R - 6), off(a + bendBy, to), rad(a), rad(a + bendBy * 2), 0.4);

    // --- jasmine nestled against the bloom: set down first, so the bloom's petals lie over them
    for (const [a, d, D, spin] of [[-44, 42, 16, 0.4], [80, 42, 15, 1.4], [206, 42, 15, 2.4]]) {
      const [x, y] = off(a, d);
      s.jasmine(x, y, D, { spin });
    }

    // --- the bloom, and the rose leaves that show from under it
    s.peony(cx, cy, R, { seed: 23, rot: 2, heart: 'rose', counts: [6, 7, 6] });
    for (const [a, L, three] of [[-133, 31, true], [44, 29, true], [-72, 25, false], [172, 25, false]]) {
      const [x, y] = off(a, R - 9);
      if (three) {
        for (const sd of [-1, 1]) {
          const [bx, by] = off(a + sd * 20, R - 8);
          s.roseLeaf(bx, by, rad(a + sd * 36), L * 0.6, { bend: sd * 0.1 });
        }
      }
      s.roseLeaf(x, y, rad(a + 5), L, { bend: 0.08 });
    }

    // --- a rosebud, and fine sprays in the gaps
    const bud = ray(-101, 45, -5);
    s.rosebud(bud.tip.x, bud.tip.y, bud.tip.a, 17);
    const sprays = [ray(10, 44, 6), ray(140, 43, -6)];
    s.pearlSpray(sprays[0].tip.x, sprays[0].tip.y, sprays[0].tip.a, { n: 3 });
    s.budSpray(sprays[1].tip.x, sprays[1].tip.y, sprays[1].tip.a, { n: 3, bud: 6.5, reach: 5 });
    for (const c of [bud, ...sprays]) s.stem(c, 1.0, 0.8, 0.66);
    // buds beside the nestled stars
    for (const [a, d, turn] of [[-56, 44, -1], [92, 44, 1], [218, 44, 1], [194, 45, -1]]) {
      const [x, y] = off(a, d - 6);
      s.bud(x, y, rad(a + turn * 18), 6.5);
    }

    // --- the two trailing vines, kinking gently from node to node
    const top = zigzag(spline([[96, 62], [112, 50], [128, 46], [144, 50], [158, 49], [168, 42], [175, 32]]), { first: 14, step: 9.5, amp: 1, side0: -1 });
    const side = zigzag(spline([[60, 106], [50, 124], [43, 144], [37, 165], [31, 187], [25, 209], [21, 232], [23, 252], [21, 268], [19, 279]]), { first: 14, step: 10, amp: 1, side0: 1 });
    s.stem(top.curve, 1.15, 0.8, 0.74);
    s.stem(side.curve, 1.15, 0.8, 0.74);

    // top vine: the first node stands above the stem, the next below, and so on
    const along = [
      ['leaf', 13.5],
      ['leaf', 13.5],
      ['jasmine', 15, 13, { spin: 0.2 }],
      ['leaf', 13],
      ['leaf', 13],
      ['buds', 6.5, 7],
      ['leaf', 12.5],
      ['leaflet', 9.5],
      ['leaflet', 8.5],
    ];
    s.spray(top.curve, along.map((item, k) => [top.u(k), k % 2 ? 1 : -1, ...item]));
    // side vine: the first node leans toward the card's edge, the next toward its middle
    const down = [
      ['leaf', 14],
      ['leaf', 14],
      ['jasmine', 15, 13, { spin: 0.8 }],
      ['leaf', 13.5],
      ['leaf', 13.5],
      ['half', 12, 10],
      ['leaf', 13.5],
      ['leaf', 13],
      ['buds', 6.5, 7],
      ['leaf', 13],
      ['leaf', 13],
      ['pearls', 1.4, 7],
      ['leaf', 12.5],
      ['leaf', 12.5],
      ['leaflet', 9.5],
      ['leaflet', 8.5],
    ];
    s.spray(side.curve, down.map((item, k) => [side.u(k), k % 2 ? -1 : 1, ...item]));
    const tipT = top.curve.tip;
    s.budSpray(tipT.x, tipT.y, tipT.a, { n: 2, bud: 6, reach: 4.5 });
    const tipS = side.curve.tip;
    s.budSpray(tipS.x, tipS.y, tipS.a, { n: 2, bud: 6, reach: 4.5 });

    return s.svg();
  },
};
