// "sprig-bottom": the sprig near the lower left corner of the envelope's bottom flap (set c).
// It rises from the bottom left toward the centre of the envelope.
import { scene, spline, zigzag, PAPER } from './_flora.mjs';

// the top left and the bottom right stay empty; and the usual margin all round
const inside = (x, y) => x >= 6.5 && y >= 6.5 && x <= 143.5 && y <= 213.5 && !(x < 62 && y < 112) && !(x > 98 && y > 148);

export default {
  name: 'sprig-bottom',
  width: 150,
  height: 220,
  material: PAPER,
  variants: { l: {}, r: { flipX: true } },
  draw() {
    const s = scene('sprig-bottom', 33, inside);
    // the stem keeps to the line from (26, 212) to (126, 14), swaying across it in a shallow S,
    // and kinks at every node as a twig does
    const line = spline([[26, 212], [43.8, 171.3], [64.9, 127.2], [88.7, 84.6], [111.3, 46.4], [121.9, 24.4]]);
    const twig = zigzag(line, { first: 8, step: 10.4, amp: 1.05, side0: 1 });
    const main = twig.curve;

    s.stem(main, 0.7, 1.1, 0.78, { from: 0, to: 0.05 });
    s.stem(main, 1.1, 0.8, 0.78, { from: 0.05, to: 1 });
    const tip = main.tip;
    s.budSpray(tip.x, tip.y, tip.a, { n: 3, bud: 6.5, reach: 5 });

    // node by node from the foot of the stem; the first leans to the lower right, the next to the
    // upper left, and so on in turn
    const nodes = [
      ['leaflet', 9.5],
      ['leaf', 13],
      ['leaf', 14],
      ['jasmine', 17, 16, { spin: 0.9 }],
      ['leaf', 14.5],
      ['leaf', 14],
      ['half', 13, 12],
      ['leaf', 14],
      ['orange', 23, 18.5, { spin: 0.2 }],
      ['leaf', 14],
      ['leaf', 13.5],
      ['rosebud', 15, 7],
      ['buds', 6.5, 8],
      ['jasmine', 15, 14, { spin: 0.1 }],
      ['leaf', 13],
      ['leaf', 12.5],
      ['pearls', 1.4, 7],
      ['leaflet', 9],
      ['leaflet', 8],
    ];
    s.spray(main, nodes.map((item, k) => [twig.u(k), k % 2 ? -1 : 1, ...item]));

    return s.svg();
  },
};
