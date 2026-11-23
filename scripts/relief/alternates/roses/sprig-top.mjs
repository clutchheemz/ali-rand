// The little spray on the envelope's top flap. "l" sits to the left of the line of text: it
// leans along the flap's slanting edge, bottom right to top left, and leaves the corner beside
// it (x > 72 and y < 96) free.
import { studio, rose, leaf, bud, stem, climb, guides, check } from './_flora.mjs';

const d = (a) => (a * Math.PI) / 180;

export default {
  name: 'sprig-top',
  width: 120,
  height: 170,
  material: 'paper',
  variants: { l: {}, r: { flipX: true } },
  draw(ctx) {
    const S = studio(ctx, 'sprig-top');

    const main = stem(S, [[95.5, 162], [93, 148], [85, 128], [73, 108], [60, 90], [50, 70], [42, 50], [33, 34], [26, 22]], 1.5, 0.8, {
      foot: 0.07,
      steps: 90,
    });
    const { at, heading } = climb(main, 400);
    // leaves stand off the stem at much the same angle all the way up: that is the rhythm of the spray
    const lower = (y, len, seed, turn = 46) => leaf(S, at(y), heading(y) - d(turn), len, { n: 3, seed });
    const upper = (y, len, seed, turn = 42) => leaf(S, at(y), heading(y) + d(turn), len, { n: 3, seed });

    // two buds at the tip, one on its own short stalk
    bud(S, main.at(1), main.heading(1), 13);
    const b1 = stem(S, [at(46), [33, 44], [26, 38]], 1.1, 0.9);
    bud(S, b1.at(1), b1.heading(1), 11, { flip: true });
    upper(38, 15, 61, 50);

    // the small rose, strung on the stem
    rose(S, at(66), 10.5, { seed: 8 });

    lower(93, 28, 67, 44);
    upper(99, 16, 63, 34);

    // the larger rose
    rose(S, at(120), 13, { seed: 21 });

    upper(139, 21, 65, 44);
    lower(150, 32, 66, 42);

    // 26 px either side of the line from (96, 164) to (18, 10), and nothing in the top right
    const along = ([x, y]) => Math.abs((x - 96) * 0.892 - (y - 164) * 0.452) <= 27;
    check(S, 'sprig-top', (p) => along(p) && !(p[0] > 72 && p[1] < 96) && p[0] >= 7 && p[1] >= 7 && p[0] <= 113 && p[1] <= 163);
    guides(S, [
      [[72, 0], [72, 96], [120, 96]],
      [[96, 164], [18, 10]],
    ]);
    return S.markup();
  },
};
