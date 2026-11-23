// "sprig-bottom": a flowering sprig for the envelope's bottom flap, rising from the lower-left
// corner toward the centre. Floral set "a".
import { flora } from './_flora.mjs';

export default {
  name: 'sprig-bottom',
  width: 150,
  height: 220,
  material: 'paper',
  variants: { l: {}, r: { flipX: true } },
  draw(ctx) {
    const fl = flora(ctx, 'sprig-bottom', { nodes: true, seed: 87122 });
    const tw = { h: 0.42, w0: 1.1, w1: 0.85 };
    const R = 1;
    const L = -1;
    const main = fl.stem(
      fl.through([[26, 212], [33.9, 188.6], [43.1, 165.9], [58.9, 139.1], [76, 113], [93.1, 86.9], [108.5, 59.9], [118.2, 34.9], [121, 22]]),
      1.9,
      1.05,
      { foot: 0.04, h: 0.6 },
    );
    const leaves = (list) => list.forEach(([t, side, len]) => fl.leafAt(main, t, side, len, len * 0.41, { spread: 46 }));
    // The flowers stand on upright stalks from the left of the stem, where a stalk keeps clear
    // of the light's diagonal in both mirrored pictures.
    const stalk = (t, len, lean = 0.5) => {
      const [x, y] = main.at(t);
      return fl.stem(fl.reach([x, y], [x + lean, y - len], -78, -96), tw.w0, tw.w1, { h: tw.h });
    };

    const s1 = stalk(0.12, 20, 3);
    fl.leafAt(s1, 0.42, L, 10, 4.3, { node: false });
    fl.blossomOn(s1, 9.2, { seed: 27 });
    const s2 = stalk(0.5, 20);
    fl.leafAt(s2, 0.42, L, 9.5, 4.1, { node: false });
    fl.blossomOn(s2, 8.5, { seed: 13 });
    fl.budOn(stalk(0.78, 10), 10, { open: true });
    // a seed head to the right
    const [sx, sy] = main.at(0.73);
    fl.seeds(sx, sy, -14, 13, { r: 1.6 });

    leaves([
      [0.04, R, 12], [0.15, R, 18], [0.22, R, 18], [0.29, L, 18], [0.36, R, 18], [0.42, L, 15],
      [0.5, R, 15.5], [0.62, R, 15], [0.66, L, 12.5], [0.84, R, 12], [0.9, L, 10], [0.94, R, 9.5],
    ]);
    fl.budOn(main, 9);

    // with FLORA_GUIDES set, the limits given in the brief are drawn over the piece (for adjusting it)
    if (process.env.FLORA_GUIDES) {
      fl.add(9, `<path d="M0 110H60V0M100 220V150H150M49.2 223.7L149.2 25.7M2.8 200.3L102.8 2.3" stroke="#555" stroke-width="0.8" fill="none"/>`);
    }
    return fl.svg();
  },
};
