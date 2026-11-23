// The tall flowering stem of the envelope's side flaps: a Damask rose shoot rising in a gentle S,
// its largest bloom at the middle, smaller roses, buds and leaves thinning toward both tips.
// "l" stands on the left flap with x = 0 at the outer edge of the screen; the drawing keeps to
// the kite the flap allows: slender at top and foot, full between y = 165 and y = 360.
import { studio, rose, leaf, bud, cup, stem, climb, spray, pearls, guides, check } from './_flora.mjs';

const d = (a) => (a * Math.PI) / 180;

export default {
  name: 'vine',
  width: 130,
  height: 520,
  material: 'paper',
  variants: { l: {}, r: { flipX: true } },
  draw(ctx) {
    const S = studio(ctx, 'vine');

    const main = stem(
      S,
      [
        [15.5, 511], [18, 486], [27, 452], [42, 418], [62, 386], [76, 352], [78, 316], [68, 284], [54, 258],
        [44, 228], [42, 196], [48, 164], [56, 134], [56, 104], [46, 76], [34, 50], [25, 28],
      ],
      1.9,
      0.9,
      { foot: 0.035, steps: 180 },
    );
    const { at } = climb(main);
    const shoot = (y, ...pts) => stem(S, [at(y), ...pts], 1.3, 0.9);

    // the tip
    bud(S, main.at(1), main.heading(1), 15);
    leaf(S, at(52), d(210), 20, { n: 3, seed: 25 });
    leaf(S, at(70), d(-35), 22, { n: 3, seed: 22 });
    leaf(S, at(96), d(200), 24, { n: 3, seed: 18 });
    const c1 = shoot(118, [66, 110], [71, 99]);
    cup(S, c1.at(1), c1.heading(1), 15);

    // first rose, to the left
    shoot(156, [42, 150], [31, 136]);
    spray(S, [[21, 120], [16.5, 106], [18.5, 92]], { leaves: 3, size: 11.5 });
    rose(S, [24, 128], 12, { seed: 21 });
    leaf(S, at(172), d(-20), 36, { n: 5, seed: 15 });
    leaf(S, at(180), d(185), 32, { n: 5, seed: 16 });

    // second rose, out to the right
    const sb = shoot(236, [58, 232], [72, 222], [84, 208]);
    leaf(S, sb.at(0.5), d(40), 20, { n: 3, seed: 13 });
    spray(S, [[98, 184], [106, 170], [108, 154]], { leaves: 3, size: 13 });
    pearls(S, [[106, 202], [115, 208], [118, 220]], { beads: 2 });
    rose(S, [94, 196], 15, { seed: 11 });
    const b1 = shoot(226, [36, 224], [28, 217], [23, 208]);
    bud(S, b1.at(1), b1.heading(1), 13, { flip: true });

    // the great rose at the middle, on the stem itself, with its leaves
    leaf(S, [45, 274], d(160), 40, { n: 5, seed: 4 });
    leaf(S, [42, 252], d(205), 26, { n: 3, seed: 9 });
    leaf(S, [72, 272], d(20), 40, { n: 5, seed: 7 });
    rose(S, [57, 262], 20.5, { seed: 3, loose: 2 });

    // below it: a half-open flower to the right, a rose to the left
    leaf(S, at(310), d(170), 36, { n: 5, seed: 28 });
    const c2 = shoot(346, [88, 344], [98, 336], [103, 327]);
    leaf(S, c2.at(0.45), d(48), 20, { n: 3, seed: 29 });
    cup(S, c2.at(1), c2.heading(1), 18);
    const sd = shoot(366, [56, 364], [44, 356], [38, 346]);
    leaf(S, sd.at(0.4), d(128), 20, { n: 3, seed: 30 });
    spray(S, [[26, 350], [19, 364], [17.5, 380]], { leaves: 3, size: 12 });
    rose(S, [30, 338], 14, { seed: 5 });

    // the last rose, to the right
    leaf(S, at(386), d(-15), 26, { n: 3, seed: 31 });
    leaf(S, at(392), d(185), 34, { n: 5, seed: 34 });
    shoot(424, [54, 426], [68, 422], [76, 416]);
    pearls(S, [[92, 406], [99, 398], [101, 388]], { beads: 2, first: -1 });
    rose(S, [84, 412], 11, { seed: 8 });

    // the foot
    leaf(S, at(438), d(190), 22, { n: 3, seed: 37 });
    const b2 = shoot(462, [32, 461], [40, 455], [45, 448]);
    bud(S, b2.at(1), b2.heading(1), 13);
    leaf(S, at(492), d(-35), 20, { n: 3, seed: 44 });

    // the kite: x from 4 to 48 at the top, widening to 126 by y = 165, narrowing again from y = 360
    const xmax = (y) => (y < 165 ? 48 + (78 * y) / 165 : y <= 360 ? 126 : 126 - (78 * (y - 360)) / 156);
    check(S, 'vine kite', ([x, y]) => x >= 6.5 && x <= xmax(y) - 1 && y >= 7 && y <= 513);
    guides(S, [[[48, 0], [126, 165], [126, 360], [48, 516]], [[4, 0], [4, 520]]]);
    return S.markup();
  },
};
