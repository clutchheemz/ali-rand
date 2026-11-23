// "sprig-top": the small sprig on the envelope's top flap, to the left of the centred text (set c).
// It leans to follow the flap's slanting edge: from the bottom right up to the top left.
import { scene, spline, zigzag, PAPER } from './_flora.mjs';

// nothing may sit in the top right, where the text is; and the usual margin all round
const inside = (x, y) => x >= 6.5 && y >= 6.5 && x <= 113.5 && y <= 163.5 && !(x > 70 && y < 98);

export default {
  name: 'sprig-top',
  width: 120,
  height: 170,
  material: PAPER,
  variants: { l: {}, r: { flipX: true } },
  draw() {
    const s = scene('sprig-top', 21, inside);
    // the stem keeps to the line from (96, 164) to (18, 10), swaying across it in a shallow S,
    // and kinks at every node as a twig does
    const line = spline([[95.4, 162.6], [84.2, 135.2], [67.9, 100.8], [49, 67.8], [30.7, 38.4], [22.6, 21.3]]);
    const twig = zigzag(line, { first: 7, step: 9, amp: 1.05, side0: -1 });
    const main = twig.curve;

    s.stem(main, 0.7, 1.1, 0.78, { from: 0, to: 0.06 });
    s.stem(main, 1.1, 0.8, 0.78, { from: 0.06, to: 1 });
    const tip = main.tip;
    s.budSpray(tip.x, tip.y, tip.a, { n: 3, bud: 6.5, reach: 5 });

    // node by node from the foot of the stem; the first leans to the lower left, the next to the
    // upper right, and so on in turn
    const nodes = [
      ['leaflet', 9],
      ['leaf', 12.5],
      ['leaf', 13.5],
      ['half', 12, 12],
      ['leaf', 14],
      ['leaf', 13.5],
      ['orange', 21, 19, { spin: 0.7 }],
      ['leaf', 13],
      ['leaflet', 10],
      ['leaf', 13],
      ['leaf', 13.5],
      ['jasmine', 16, 15, { spin: 0.3 }],
      ['buds', 6.5, 8],
      ['leaf', 12.5],
      ['leaf', 12.5],
      ['pearls', 1.4, 7],
      ['leaflet', 9.5],
      ['leaflet', 8.5],
    ];
    s.spray(main, nodes.map((item, k) => [twig.u(k), k % 2 ? 1 : -1, ...item]));

    return s.svg();
  },
};
