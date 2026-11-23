// "corner": the bouquet that fills each corner of the invitation card: a full garden rose
// seen from the front, with its toothed leaves and two buds, the wild blossoms of the envelope's
// sprays beside it, and a vine trailing away along each edge. Floral set "a".
//
// To place the "tl" picture: the rose is centred at (70, 76) and is 68 across; the top vine
// ends at about (182, 36); the side vine ends at about (21, 292).
import { flora } from './_flora.mjs';

export default {
  name: 'corner',
  width: 190,
  height: 300,
  material: 'paper',
  variants: { tl: {}, tr: { flipX: true }, bl: { flipY: true }, br: { flipX: true, flipY: true } },
  draw(ctx) {
    const fl = flora(ctx, 'corner');
    const tw = { h: 0.42, w0: 1.1, w1: 0.85 };
    const R = 1; // the right of a stem as it grows: below the top vine, outside the side vine
    const L = -1;
    const roseLeaves = (curve, list) => list.forEach(([t, side, len, spread]) => fl.roseLeafAt(curve, t, side, len, len * 0.47, spread ? { spread } : {}));
    // toward its tip a vine carries the slim leaves of the wildflower sprays
    const tipLeaves = (curve, list) => list.forEach(([t, side, len]) => fl.leafAt(curve, t, side, len, len * 0.42, { node: true }));
    const [cx, cy] = [70, 76];

    // ---- the vine along the top edge
    const top = fl.stem(fl.through([[94, 58], [103, 44], [114, 35], [128, 31], [142, 34], [155, 40], [165, 40], [172, 37]]), 1.7, 0.9);
    const ta = fl.twigTo(top, 0.17, R, [116, 49], { ...tw, leave: 44, arrive: 66 });
    fl.blossomOn(ta, 13, { seed: 19 });
    const tb = fl.twigTo(top, 0.67, L, [148, 27], { ...tw, leave: -62, arrive: -82 });
    fl.blossomOn(tb, 8.5, { seed: 41, sit: 0.85 });
    roseLeaves(top, [[0.14, L, 21], [0.3, L, 21], [0.45, L, 19], [0.57, R, 19]]);
    tipLeaves(top, [[0.76, R, 15], [0.92, R, 12]]);
    {
      // a seed head, the wildflower sprays' signature, lifted above the tip
      const [x, y] = top.at(0.85);
      fl.seeds(x, y, -72, 11, { r: 1.5 });
    }
    fl.budOn(top, 9);

    // ---- the vine down the left edge: its leaves shorten as the band it may use narrows
    const side = fl.stem(fl.through([[50, 104], [39, 119], [31, 138], [26, 160], [24, 184], [23, 208], [24, 232], [24, 256], [22, 274], [21, 281]]), 1.7, 0.9);
    const sa = fl.twigTo(side, 0.09, L, [42, 126], { ...tw, leave: 44, arrive: 22 });
    fl.blossomOn(sa, 12, { seed: 29 });
    const sb = fl.twigTo(side, 0.4, L, [30, 180], { ...tw, leave: 44, arrive: 30 });
    fl.blossomOn(sb, 8, { seed: 43, sit: 0.8 });
    roseLeaves(side, [[0.07, R, 21], [0.16, R, 21], [0.24, L, 19], [0.33, R, 17], [0.34, L, 16], [0.51, R, 15]]);
    tipLeaves(side, [[0.61, R, 14.5], [0.75, R, 14.5], [0.82, L, 12.5], [0.89, R, 13], [0.94, L, 11]]);
    {
      const [x, y] = side.at(0.69);
      fl.seeds(x, y, 20, 9, { r: 1.45, fan: 34 });
    }
    fl.budOn(side, 9);

    // ---- the rose and its leaves
    fl.roseLeaf(46, 66, -168, 34, 15, { bend: 0.2 });
    fl.roseLeaf(62, 46, -104, 31, 13.5, { bend: -0.2 });
    fl.roseLeaf(40, 88, 176, 26, 12, { bend: -0.2 });
    fl.roseLeaf(100, 86, 18, 29, 13, { bend: 0.25 });
    fl.roseLeaf(80, 106, 70, 28, 12.5, { bend: -0.25 });
    // two buds: one reaching for the corner, one rising beside the top vine
    const cb = fl.stem(fl.reach([52, 54], [37, 39], -128, -140), 1.3, 0.95, { h: 0.46 });
    fl.budOn(cb, 13);
    const ub = fl.stem(fl.reach([80, 48], [83, 27], -76, -92), 1.3, 0.95, { h: 0.46 });
    fl.budOn(ub, 11.5);
    fl.rose(cx, cy, 34, { seed: 8 });

    // with FLORA_GUIDES set, the limits given in the brief are drawn over the piece (for adjusting it)
    if (process.env.FLORA_GUIDES) {
      fl.add(9, `<path d="M150 84L38 200M150 80H190M38 200V300M184 0V80M0 294H38" stroke="#555" stroke-width="0.8" fill="none"/>`);
    }
    return fl.svg();
  },
};
