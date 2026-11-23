// Corner bouquet of the invitation card: one full Damask rose with its leaves, two smaller roses
// and a bud, and two trailing vines that run along the top and down the side.
import { studio, rose, leaf, leaflet, bud, stem, pearls, guides, check } from './_flora.mjs';

const d = (a) => (a * Math.PI) / 180;

export default {
  name: 'corner',
  width: 190,
  height: 300,
  material: 'paper',
  variants: { tl: {}, tr: { flipX: true }, bl: { flipY: true }, br: { flipX: true, flipY: true } },
  draw(ctx) {
    const S = studio(ctx, 'corner');

    // leaves behind the great rose
    leaf(S, [56, 64], d(-137), 56, { n: 5, seed: 12 }); // into the corner
    leaf(S, [70, 46], d(-95), 34, { n: 3, seed: 5 }); // up
    leaf(S, [44, 86], d(172), 34, { n: 3, seed: 8 }); // out to the side
    leaf(S, [94, 54], d(-40), 30, { n: 3, seed: 17 }); // between the roses, above
    leaf(S, [100, 82], d(5), 34, { n: 3, seed: 3 }); // along
    leaf(S, [88, 98], d(50), 32, { n: 3, seed: 14 }); // toward the middle of the card
    leaf(S, [66, 100], d(98), 48, { n: 5, seed: 21 }); // down
    leaf(S, [46, 100], d(135), 28, { n: 3, seed: 19 }); // between the roses, below
    // one leaflet lying lower, in the gap, and a thread of seed-pearl buds
    leaflet(S, [78, 106], d(75), 22, { top: 0.48, z: 3 });
    pearls(S, [[100, 94], [112, 103], [119, 100]], { beads: 2 });

    // a bud standing up between the leaves
    const b1 = stem(S, [[86, 46], [92, 32], [99, 23]], 1.3, 1.0);
    bud(S, b1.at(1), b1.heading(1), 13);

    // the vine along the top edge, carrying the second rose
    const top = stem(S, [[96, 62], [112, 48], [128, 42], [145, 34], [157, 29.5], [164.5, 28.5]], 1.6, 0.9);
    leaf(S, [146, 33.5], d(50), 22, { n: 3, seed: 31 });
    leaf(S, [154, 30.5], d(-40), 20, { n: 3, seed: 32 });
    leaf(S, top.at(1), d(10), 16.5, { n: 3, seed: 33 });
    rose(S, [128, 42], 15, { seed: 6 });

    // the vine down the side, carrying the third
    const side = stem(S, [[48, 104], [38, 124], [32, 146], [27, 168], [24.5, 190], [25, 211], [23.5, 232], [21.5, 253], [21, 272]], 1.6, 0.9);
    leaf(S, [27.5, 168], d(62), 22, { n: 3, seed: 41 });
    leaf(S, [24.5, 188], d(125), 20, { n: 3, seed: 42 });
    leaf(S, [25, 210], d(64), 20, { n: 3, seed: 43 });
    leaf(S, [23.5, 232], d(122), 19, { n: 3, seed: 45 });
    leaf(S, [21.5, 253], d(66), 18, { n: 3, seed: 46 });
    leaf(S, side.at(1), d(92), 18, { n: 3, seed: 44 });
    rose(S, [32, 146], 12.5, { seed: 9 });

    rose(S, [70, 76], 32.5, { seed: 3, z: 12, ruffle: 1.5, loose: 2 });

    check(S, 'corner body', ([x, y]) => x >= 7 && y >= 7 && x <= 182 && y <= 292 && (116 * x + 112 * y < 26808 || y < 80 || x < 38));
    guides(S, [
      [[150, 84], [38, 200]],
      [[150, 80], [190, 80]],
      [[38, 200], [38, 300]],
    ]);
    return S.markup();
  },
};
