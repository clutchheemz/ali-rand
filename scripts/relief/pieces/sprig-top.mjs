// "sprig-top": a light flowering sprig for the envelope's top flap, leaning up to the left
// along the flap's slanting edge. Floral set "a".
import { flora } from './_flora.mjs';

export default {
  name: 'sprig-top',
  width: 120,
  height: 170,
  material: 'paper',
  variants: { l: {}, r: { flipX: true } },
  draw(ctx) {
    const fl = flora(ctx, 'sprig-top', { nodes: true, seed: 63365 });
    const tw = { h: 0.42, w0: 1.1, w1: 0.85 };
    const R = 1;
    const L = -1;
    const main = fl.stem(
      fl.through([[95.5, 162], [90.5, 145.4], [83.7, 127.6], [71, 107], [57, 87], [43, 67], [30.7, 46.2], [23.6, 26.5], [21.5, 19]]),
      1.9,
      1.05,
      { foot: 0.05, h: 0.6 },
    );
    const leaves = (list) => list.forEach(([t, side, len]) => fl.leafAt(main, t, side, len, len * 0.41, { spread: 46 }));
    // The flowers stand on upright stalks from the right of the stem, where a stalk keeps clear
    // of the light's diagonal in both mirrored pictures.
    const stalk = (t, len, lean = 1) => {
      const [x, y] = main.at(t);
      return fl.stem(fl.reach([x, y], [x + lean, y - len], -102, -84), tw.w0, tw.w1, { h: tw.h });
    };

    const s1 = stalk(0.12, 20, -1);
    fl.leafAt(s1, 0.42, R, 9.5, 4.1, { node: false });
    fl.blossomOn(s1, 8.5, { seed: 11 });
    const s2 = stalk(0.53, 18, -0.5);
    fl.leafAt(s2, 0.42, R, 9, 3.9, { node: false });
    fl.blossomOn(s2, 7.5, { seed: 5 });
    fl.budOn(stalk(0.78, 10), 8.5);
    // a seed head to the left
    const [sx, sy] = main.at(0.66);
    fl.seeds(sx, sy, -172, 12, { r: 1.5 });

    leaves([
      [0.04, L, 11.5], [0.16, L, 17], [0.24, R, 12], [0.3, L, 17], [0.36, R, 11.5], [0.45, L, 15.5],
      [0.58, L, 14.5], [0.74, L, 12.5], [0.84, L, 11.5], [0.9, R, 10], [0.95, L, 9.5],
    ]);
    fl.budOn(main, 9);

    // with FLORA_GUIDES set, the limits given in the brief are drawn over the piece (for adjusting it)
    if (process.env.FLORA_GUIDES) {
      fl.add(9, `<path d="M72 0V96H120M119.2 152.2L41.2 -1.8M72.8 175.8L-5.2 21.8" stroke="#555" stroke-width="0.8" fill="none"/>`);
    }
    return fl.svg();
  },
};
