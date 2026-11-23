// "vine": the tall flowering spray that stands on each side flap of the envelope: a sheaf of
// slender stems gathered at the foot and fanning out to the width of the flap.
// The "l" picture has x = 0 toward the outer edge of the screen. Floral set "a".
import { flora } from './_flora.mjs';

export default {
  name: 'vine',
  width: 130,
  height: 520,
  material: 'paper',
  variants: { l: {}, r: { flipX: true } },
  draw(ctx) {
    const fl = flora(ctx, 'vine', { nodes: true });
    // The stems keep within some twenty degrees of upright: a line that runs along the light
    // (the sheet's diagonal) casts no shade and is lost, and each diagonal is the light's in
    // one of the two mirrored pictures.
    const main = fl.stem(
      fl.through([[25, 510], [27, 470], [33, 425], [42, 380], [51, 335], [58, 290], [62, 245], [62, 200], [57, 158], [48, 118], [39, 82], [33, 50], [30, 22]]),
      1.9,
      0.95,
      { foot: 0.03 },
    );
    const at = (y) => fl.atY(main, y);
    const tw = { h: 0.42, w0: 1.2, w1: 0.85 };
    const M = [19, 7.6];
    const S = [15, 6.2];
    const X = [12, 5];
    const R = 1; // the right of a stem as it grows
    const L = -1;
    /** Leaves on a line: [t, side, size, spread?] each. */
    const leaves = (curve, list) => list.forEach(([t, side, size, spread]) => fl.leafAt(curve, t, side, ...size, spread ? { spread } : {}));

    // ---- right-hand stems
    // RA: the smallest blossom, low on the right
    const ra = fl.twigTo(main, at(503), R, [56, 443], { ...tw, leave: -62, arrive: -72 });
    leaves(ra, [[0.3, R, S], [0.55, L, X, 46]]);
    {
      const [x, y] = ra.at(0.56);
      fl.seeds(x, y, -8, 13, { r: 1.6 });
    }
    fl.blossomOn(ra, 10, { seed: 21, collar: [10, 4.4] });

    // RB: the great blossom, right of the middle
    const rb = fl.twigTo(main, at(424), R, [87, 289], { ...tw, leave: -62, arrive: -72, w0: 1.4 });
    leaves(rb, [[0.2, R, S], [0.37, R, M], [0.7, L, X, 44], [0.78, R, S], [0.86, L, S, 44]]);
    fl.blossomOn(rb, 19, { seed: 4, collar: X });
    // its spur: an opening bud held out to the right
    const rbs = fl.twigTo(rb, 0.47, R, [101, 337], { ...tw, leave: -32, arrive: -14 });
    leaves(rbs, [[0.34, L, S], [0.56, R, X], [0.76, L, X]]);
    fl.budOn(rbs, 10, { open: true });

    // RC: the third blossom, upper right
    const rc = fl.twigTo(main, at(262), R, [84, 153], { ...tw, leave: -74, arrive: -80 });
    leaves(rc, [[0.15, R, S], [0.5, R, S], [0.62, L, X, 40], [0.73, R, S], [0.85, L, X, 40]]);
    fl.blossomOn(rc, 11, { seed: 15, collar: [10, 4.4], tilt: 0.82 });
    // its spur: a leafy sprig with a seed head, reaching for the right edge
    const rcs = fl.twigTo(rc, 0.3, R, [106, 213], { ...tw, leave: -26, arrive: -8 });
    leaves(rcs, [[0.3, L, S], [0.52, R, X], [0.74, L, X]]);
    fl.seedsOn(rcs, 12, { turn: -6 });

    // RD: a bud, upper right
    const rd = fl.twigTo(main, at(152), R, [72, 105], { ...tw, leave: -80, arrive: -66 });
    leaves(rd, [[0.66, R, X]]);
    fl.budOn(rd, 9);

    // ---- left-hand stems
    // LA: a middling blossom, low on the left
    const la = fl.twigTo(main, at(436), L, [25, 393], { ...tw, leave: -108, arrive: -97 });
    leaves(la, [[0.42, L, S]]);
    fl.blossomOn(la, 13, { seed: 33, collar: X, tilt: 0.86 });

    // LB: a budding branch
    const lb = fl.twigTo(main, at(372), L, [17, 293], { ...tw, leave: -100, arrive: -112 });
    leaves(lb, [[0.3, L, S], [0.54, L, S], [0.68, R, X, 46], [0.8, L, X], [0.9, R, [11, 4.6], 46]]);
    fl.budOn(lb, 10);

    // LC: the second blossom, upper left
    const lc = fl.twigTo(main, at(318), L, [34, 223], { ...tw, leave: -97, arrive: -101, w0: 1.3 });
    leaves(lc, [[0.25, L, M], [0.5, L, S], [0.6, R, X, 40], [0.72, L, S], [0.76, R, X, 40]]);
    fl.blossomOn(lc, 14, { seed: 9, collar: X });

    // LD: a budding branch, upper left
    const ld = fl.twigTo(main, at(216), L, [31, 139], { ...tw, leave: -106, arrive: -118 });
    leaves(ld, [[0.36, L, S], [0.6, L, S], [0.82, L, X], [0.9, R, [11, 4.6], 46]]);
    fl.budOn(ld, 10);

    // LE: a bud near the tip
    const le = fl.twigTo(main, at(112), L, [30, 79], { ...tw, leave: -112, arrive: -118 });
    leaves(le, [[0.5, L, [10, 4.4]]]);
    fl.budOn(le, 9);

    // ---- leaves on the main stem, wherever a side stem leaves room
    const mainLeaves = [
      [498, L, X], [484, L, S], [466, L, M], [450, R, S], [448, L, S],
      [318, R, S], [302, R, S], [244, L, X],
      [172, R, X], [124, L, S], [104, R, S], [66, L, X], [58, R, X], [46, L, [10, 4.4]], [42, R, [10, 4.4]],
    ];
    mainLeaves.forEach(([y, side, size]) => fl.leafAt(main, at(y), side, ...size));
    {
      // a seed head near the tip
      const [x, y] = main.at(at(74));
      fl.seeds(x, y, -34, 13, { r: 1.6 });
    }
    fl.budOn(main, 10);

    // with FLORA_GUIDES set, the kite the brief allows is drawn over the piece (for adjusting it)
    if (process.env.FLORA_GUIDES) {
      fl.add(9, `<path d="M4 0V520M48 0L126 165V360L48 516" stroke="#555" stroke-width="0.8" fill="none"/>`);
    }
    return fl.svg();
  },
};
