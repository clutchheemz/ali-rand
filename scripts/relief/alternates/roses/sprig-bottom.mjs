// The spray on the envelope's bottom flap. "l" sits near the lower left corner and rises toward
// the centre, bottom left to top right; the corners beside it (x < 60 with y < 110, and x > 100
// with y > 150) stay free.
import { studio, rose, leaf, bud, cup, stem, climb, guides, check } from './_flora.mjs';

const d = (a) => (a * Math.PI) / 180;

export default {
  name: 'sprig-bottom',
  width: 150,
  height: 220,
  material: 'paper',
  variants: { l: {}, r: { flipX: true } },
  draw(ctx) {
    const S = studio(ctx, 'sprig-bottom');

    const main = stem(S, [[26.5, 211], [33, 192], [45, 170], [60, 148], [73, 124], [83, 100], [96, 76], [109, 54], [119, 30]], 1.6, 0.8, {
      foot: 0.07,
      steps: 90,
    });
    const { at, heading } = climb(main, 400);
    // leaves stand off the stem at much the same angle all the way up: that is the rhythm of the spray
    const upper = (y, len, seed, turn = 46) => leaf(S, at(y), heading(y) - d(turn), len, { n: 3, seed });
    const lower = (y, len, seed, turn = 44) => leaf(S, at(y), heading(y) + d(turn), len, { n: 3, seed });

    // two buds at the tip, one on its own short stalk
    bud(S, main.at(1), main.heading(1), 14);
    upper(44, 16, 71, 50);
    lower(56, 22, 72);
    const b1 = stem(S, [at(70), [94, 63], [90, 55]], 1.1, 0.9);
    bud(S, b1.at(1), b1.heading(1), 12, { flip: true });

    // the smaller rose, strung on the stem
    lower(82, 24, 78);
    rose(S, at(98), 11.5, { seed: 8 });
    upper(116, 26, 74, 50);

    // a half-open flower on the lower side
    const c1 = stem(S, [at(132), [80, 132], [88, 128], [92, 121]], 1.1, 0.9);
    cup(S, c1.at(1), c1.heading(1), 17);

    // the larger rose
    rose(S, at(160), 14, { seed: 5 });
    upper(186, 30, 76);
    lower(198, 34, 77);

    // 26 px either side of the line from (26, 212) to (126, 14); two corners kept empty
    const along = ([x, y]) => Math.abs((x - 26) * 0.893 + (y - 212) * 0.451) <= 27;
    check(
      S,
      'sprig-bottom',
      (p) => along(p) && !(p[0] < 60 && p[1] < 110) && !(p[0] > 100 && p[1] > 150) && p[0] >= 7 && p[1] >= 7 && p[0] <= 143 && p[1] <= 213,
    );
    guides(S, [
      [[60, 0], [60, 110], [0, 110]],
      [[100, 220], [100, 150], [150, 150]],
      [[26, 212], [126, 14]],
    ]);
    return S.markup();
  },
};
