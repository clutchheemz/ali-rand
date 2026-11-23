// The shared botanical vocabulary of floral set "a": a wildflower spray in the manner of a
// blind-embossing die. Every piece of the set draws with these functions, so stems, leaves,
// blossoms, buds and beads are cut by the same hand on every sheet.
//
// Usage inside a piece's draw(ctx):
//   const fl = flora(ctx, 'vine');      // the second argument prefixes every id in <defs>
//   const stem = fl.stem(fl.through([[x, y], ...]), 2, 1);
//   fl.leafAt(stem, 0.3, +1, 19, 7.6); fl.blossom(x, y, 14); ...
//   return fl.svg();
//
// Heights: 0 is the paper, 1 the highest point of the die. Angles handed to these functions
// are in degrees, clockwise from east as on a screen (so -90 points up the sheet).

// Options: `nodes` raises a small knot on the stem wherever a leaf springs from it; `seed`
// starts the stream of small natural variations (leaf size, curl and turn).

export function flora(kit, id, { nodes = false, seed = id.length * 7919 + 13 } = {}) {
  const { f, grey, rad, rng, cubic, taper, W, H } = kit;
  const defs = [];
  const items = [];
  const made = new Map();
  let serial = 0;
  const wobble = rng(seed);

  /** Queue markup at depth-order z (higher is painted later, so it lies on top). */
  const add = (z, s) => items.push({ z, i: items.length, s });

  const stops = (list) => list.map(([o, v]) => `<stop offset="${f(o)}" stop-color="${grey(v)}"/>`).join('');

  // Both modelling filters work the same way: the shape's own coverage, blurred, says how far a
  // point is from the edge (0.5 on a straight edge, 1 deep inside, less than 0.5 in a sharp
  // tip); a table turns that into the share of the drawn height that is kept there.
  const modeller = (key, sigma, table) => {
    if (!made.has(key)) {
      const name = `${id}-${key.replace(/[.]/g, 'p')}`;
      defs.push(
        `<filter id="${name}" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}" color-interpolation-filters="sRGB">` +
          `<feGaussianBlur in="SourceAlpha" stdDeviation="${f(sigma)}"/>` +
          `<feComponentTransfer result="v"><feFuncA type="table" tableValues="${table.map((v) => f(1 - v)).join(' ')}"/></feComponentTransfer>` +
          `<feComposite in="v" in2="SourceGraphic" operator="atop"/></filter>`,
      );
      made.set(key, name);
    }
    return `url(#${made.get(key)})`;
  };

  /**
   * Models whatever it is given into a cushion: full height in the middle of the shape,
   * falling to `lo` of it at the edge. `sigma` is how far in the shoulder reaches (design px).
   */
  const dome = (sigma, lo = 0.6, round = 0.62, tips = 0.8) =>
    modeller(`d_${f(sigma)}_${f(lo)}_${f(round)}_${f(tips)}`, sigma, [tips * lo, (tips + 1) * 0.5 * lo, lo, lo + (1 - lo) * round, 1]);

  /**
   * The opposite: the rim keeps its height and the inside sinks by `depth` of it, the way a
   * petal cups behind its edge.
   */
  const bowl = (sigma, depth = 0.3) => modeller(`b_${f(sigma)}_${f(depth)}`, sigma, [1, 1, 1, 1 - depth * 0.6, 1 - depth]);

  /** Local-to-sheet coordinates: u runs along `a` (radians) from (x, y), v across it. `m` is an optional 2x2 squash. */
  const place = (x, y, a, m) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return (u, v) => {
      let px = c * u - s * v;
      let py = s * u + c * v;
      if (m) [px, py] = [m[0] * px + m[1] * py, m[2] * px + m[3] * py];
      return `${f(x + px)} ${f(y + py)}`;
    };
  };

  // ---- lines ----------------------------------------------------------------------------------

  /** Joins cubic segments into one line measured by distance: at(0.5) is half way along it. */
  function chain(segs) {
    const N = 24;
    const table = [{ s: 0, i: 0, u: 0 }];
    let total = 0;
    let prev = segs[0].at(0);
    segs.forEach((sg, i) => {
      for (let k = 1; k <= N; k++) {
        const q = sg.at(k / N);
        total += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
        table.push({ s: total, i, u: k / N });
        prev = q;
      }
    });
    const locate = (t) => {
      const s = Math.max(0, Math.min(1, t)) * total;
      let lo = 0;
      let hi = table.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (table[mid].s <= s) lo = mid;
        else hi = mid;
      }
      const A = table[lo];
      const B = table[hi];
      const w = B.s > A.s ? (s - A.s) / (B.s - A.s) : 0;
      return A.i !== B.i ? { i: B.i, u: w * B.u } : { i: A.i, u: A.u + w * (B.u - A.u) };
    };
    return {
      at: (t) => {
        const { i, u } = locate(t);
        return segs[i].at(u);
      },
      heading: (t) => {
        const { i, u } = locate(t);
        return segs[i].heading(Math.max(0.001, Math.min(0.999, u)));
      },
      length: total,
    };
  }

  /** A smooth line through the given points. */
  function through(points) {
    const n = points.length - 1;
    const segs = [];
    for (let i = 0; i < n; i++) {
      const a = points[Math.max(0, i - 1)];
      const b = points[i];
      const c = points[i + 1];
      const d = points[Math.min(n, i + 2)];
      segs.push(
        cubic(b, [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6], [c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6], c),
      );
    }
    return chain(segs);
  }

  /** A line that starts at (x, y) heading `a` (radians), runs `len` and turns by `bend` radians on the way. */
  function sweep(x, y, a, len, bend = 0) {
    const k = len / 3;
    const chord = Math.abs(bend) < 1e-4 ? len : (len * Math.sin(bend / 2)) / (bend / 2);
    const p3 = [x + Math.cos(a + bend / 2) * chord, y + Math.sin(a + bend / 2) * chord];
    return chain([
      cubic([x, y], [x + Math.cos(a) * k, y + Math.sin(a) * k], [p3[0] - Math.cos(a + bend) * k, p3[1] - Math.sin(a + bend) * k], p3),
    ]);
  }

  /** A line from p to q that leaves heading `a0` and arrives heading `a1` (degrees). */
  function reach(p, q, a0, a1, pull = 0.36) {
    const k = Math.hypot(q[0] - p[0], q[1] - p[1]) * pull;
    return chain([
      cubic(p, [p[0] + Math.cos(rad(a0)) * k, p[1] + Math.sin(rad(a0)) * k], [q[0] - Math.cos(rad(a1)) * k, q[1] - Math.sin(rad(a1)) * k], q),
    ]);
  }

  /** The stretch of a line between t0 and t1, as a line of its own. */
  const part = (curve, t0, t1) => ({
    at: (t) => curve.at(t0 + (t1 - t0) * t),
    heading: (t) => curve.heading(t0 + (t1 - t0) * t),
    length: (curve.length ?? 0) * Math.abs(t1 - t0),
  });

  const deg = (curve, t) => (curve.heading(t) * 180) / Math.PI;

  /** How far along a line (0..1) it passes the height y; for lines that run steadily up or down the sheet. */
  function atY(curve, y) {
    let lo = 0;
    let hi = 1;
    const rising = curve.at(1)[1] > curve.at(0)[1];
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (curve.at(mid)[1] < y === rising) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /** The outline of a blade along `curve` whose two sides may differ: wl(t) and wr(t) are the half-widths. */
  function blade(curve, wl, wr, steps = 22) {
    const left = [];
    const right = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const [x, y] = curve.at(t);
      const a = curve.heading(t) + Math.PI / 2;
      left.push(`${f(x + Math.cos(a) * wl(t))} ${f(y + Math.sin(a) * wl(t))}`);
      right.push(`${f(x - Math.cos(a) * wr(t))} ${f(y - Math.sin(a) * wr(t))}`);
    }
    return `M${left.join('L')}L${right.reverse().join('L')}Z`;
  }

  // ---- the vocabulary -------------------------------------------------------------------------

  /** A stem: a fine ridge along `curve`, w0 wide at its foot and w1 at its tip. */
  function stem(curve, w0 = 1.6, w1 = 1, o = {}) {
    const { h = 0.46, z = 2, foot = 0 } = o;
    const steps = o.steps ?? Math.max(12, Math.round((curve.length ?? 60) / 3));
    // `foot` is the stretch (0..1) over which the stem swells from a hair to its full width
    const swell = (t) => (foot && t < foot ? 0.45 + 0.55 * Math.sin((t / foot) * Math.PI * 0.5) : 1);
    add(z, `<path d="${taper(curve, (t) => (w0 + (w1 - w0) * t) * swell(t), steps)}" fill="${grey(h)}"/>`);
    // a rounded tip, so the ridge does not end in a cut
    const [x, y] = curve.at(1);
    add(z, `<circle cx="${f(x)}" cy="${f(y)}" r="${f(w1 / 2)}" fill="${grey(h)}"/>`);
    return curve;
  }

  /**
   * A slim pointed leaf growing from (x, y) along `a` (degrees), `len` long and `wid` wide:
   * two cushioned halves either side of a centre vein. `bend` (radians) curves it; `turn`
   * makes one half broader than the other, as when a leaf is seen a little from the side.
   */
  function leaf(x, y, a, len, wid, o = {}) {
    const { bend = 0, h = 0.62, z = 1, belly = 0.36, tip = 1.25, lo = 0.6 } = o;
    const turn = o.turn ?? (wobble() - 0.5) * 0.36;
    // the vein is cut wide and deep: anything finer is smoothed away by the press
    const vein = o.vein ?? (wid >= 5.2 ? 0.93 : 0);
    const veinW = o.veinW ?? Math.min(2.2, Math.max(1.6, wid * 0.25));
    const mid = sweep(x, y, rad(a), len, bend);
    const q = tip;
    const p = (q * belly) / (1 - belly);
    const norm = Math.pow(belly, p) * Math.pow(1 - belly, q);
    const half = (t) => (0.5 * wid * Math.pow(t, p) * Math.pow(1 - t, q)) / norm;
    const d = blade(mid, (t) => half(t) * (1 + turn), (t) => half(t) * (1 - turn));
    add(z, `<path d="${d}" fill="${grey(h)}" filter="${dome(Math.max(1, wid * 0.3), lo)}"/>`);
    if (vein > 0) {
      add(z, `<path d="${taper(part(mid, 0.03, 0.88), (t) => veinW * (1 - 0.55 * t), 10)}" fill="#000" fill-opacity="${f(vein)}"/>`);
    }
    return mid;
  }

  /**
   * A rose leaf: broader than the wildflower leaf, its edge finely toothed, with a midrib and
   * side veins. From (x, y) along `a` (degrees).
   */
  function roseLeaf(x, y, a, len, wid, o = {}) {
    const { bend = 0, h = 0.66, z = 1, belly = 0.42, tip = 1.05, lo = 0.56, teeth = 7, veins = 4, turn = 0 } = o;
    const mid = sweep(x, y, rad(a), len, bend);
    const q = tip;
    const p = (q * belly) / (1 - belly);
    const norm = Math.pow(belly, p) * Math.pow(1 - belly, q);
    const smooth = (t) => (0.5 * wid * Math.pow(t, p) * Math.pow(1 - t, q)) / norm;
    // each tooth swells and then drops back sharply, pointing toward the tip
    const saw = (t) => {
      const u = (t * teeth) % 1;
      return 1 + 0.085 * (u < 0.75 ? u / 0.75 : (1 - u) / 0.25) - 0.04;
    };
    const half = (t) => smooth(t) * (t > 0.1 && t < 0.94 ? saw(t) : 1);
    const d = blade(mid, (t) => half(t) * (1 + turn), (t) => half(t) * (1 - turn), teeth * 8);
    add(z, `<path d="${d}" fill="${grey(h)}" filter="${dome(Math.max(1.2, wid * 0.26), lo)}"/>`);
    // side veins first, then the midrib over their roots
    for (let i = 0; i < veins; i++) {
      const t = 0.16 + (0.6 * i) / Math.max(1, veins - 1);
      const [vx, vy] = mid.at(t);
      const va = mid.heading(t);
      for (const sd of [-1, 1]) {
        const out = smooth(t + 0.1) * (1 - sd * turn) * 1.02;
        const c = sweep(vx, vy, va + sd * rad(58), out / Math.sin(rad(50)), -sd * 0.35);
        add(z, `<path d="${taper(c, (u) => 1.15 * (1 - 0.5 * u), 6)}" fill="#000" fill-opacity="0.5"/>`);
      }
    }
    add(z, `<path d="${taper(part(mid, 0.02, 0.9), (t) => 1.7 * (1 - 0.55 * t), 12)}" fill="#000" fill-opacity="0.85"/>`);
    return mid;
  }

  function petalPath(pl, L, Wd, notch = 0) {
    const tx = L * (1 - notch);
    const cap = notch
      ? `C${pl(0.85 * L, -Wd)} ${pl(1.0 * L, -0.78 * Wd)} ${pl(0.99 * L, -0.38 * Wd)}` +
        `C${pl(0.985 * L, -0.17 * Wd)} ${pl(tx + 0.03 * L, -0.06 * Wd)} ${pl(tx, 0)}` +
        `C${pl(tx + 0.03 * L, 0.06 * Wd)} ${pl(0.985 * L, 0.17 * Wd)} ${pl(0.99 * L, 0.38 * Wd)}` +
        `C${pl(1.0 * L, 0.78 * Wd)} ${pl(0.85 * L, Wd)} ${pl(0.6 * L, Wd)}`
      : `C${pl(0.84 * L, -Wd)} ${pl(L, -0.62 * Wd)} ${pl(L, 0)}C${pl(L, 0.62 * Wd)} ${pl(0.84 * L, Wd)} ${pl(0.6 * L, Wd)}`;
    return (
      `M${pl(0, 0)}C${pl(0.16 * L, -0.3 * Wd)} ${pl(0.3 * L, -Wd)} ${pl(0.6 * L, -Wd)}` +
      cap +
      `C${pl(0.3 * L, Wd)} ${pl(0.16 * L, 0.3 * Wd)} ${pl(0, 0)}Z`
    );
  }

  /** A raised bead. */
  function bead(x, y, r, o = {}) {
    const { h = 1, z = 5 } = o;
    add(z, `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${grey(h)}"/>`);
  }

  /**
   * An open blossom seen from the front: five overlapping petals, each a cushion inside a
   * slightly raised rim, falling away to a beaded eye. R is the radius to the petal tips;
   * `rot` (degrees) turns it; `squash` < 1 foreshortens it along the direction `lean`
   * (degrees), as if the flower were turned a little away.
   */
  function blossom(cx, cy, R, o = {}) {
    const { rot = -90, seed = 7, squash = 1, lean = 0, z = 4, petals = 5, h = 0.7, plump = 0.44, cut = 0.75 } = o;
    const notch = o.notch ?? (R >= 13 ? 0.08 : 0);
    const r = rng(seed);
    let m = null;
    let gt = '';
    if (squash !== 1) {
      const c = Math.cos(rad(lean));
      const s = Math.sin(rad(lean));
      m = [c * c * squash + s * s, c * s * (squash - 1), c * s * (squash - 1), s * s * squash + c * c];
      gt = ` gradientTransform="translate(${f(cx)} ${f(cy)}) rotate(${f(lean)}) scale(${f(squash)} 1) rotate(${f(-lean)}) translate(${f(-cx)} ${f(-cy)})"`;
    }
    const gid = `${id}-g${serial++}`;
    defs.push(
      `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}"${gt}>` +
        stops([[0, 0.42 * h], [0.2, 0.56 * h], [0.6, h], [0.86, 0.97 * h], [1, 0.8 * h]]) +
        `</radialGradient>`,
    );
    const order = petals === 5 ? [0, 2, 4, 1, 3] : [...Array(petals).keys()];
    const step = 360 / petals;
    const jit = order.map(() => [(r() - 0.5) * 9, 0.94 + r() * 0.1, 0.94 + r() * 0.12]);
    for (const i of order) {
      const a = rad(rot + i * step + jit[i][0]);
      const L = R * jit[i][1];
      const Wd = R * plump * jit[i][2];
      const pl = place(cx, cy, a, m);
      const d = petalPath(pl, L, Wd, notch);
      // a groove cut into whatever lies under this petal's edge, so the petals part cleanly
      add(z, `<path d="${d}" stroke="#000" stroke-opacity="${f(cut)}" stroke-width="2.4" stroke-linejoin="round" fill="none"/>`);
      // each petal is a cushion inside a slightly raised rim: the dip between the two throws a
      // fine shadow just inside the edge, so the petals facing the light keep their outline
      const sg = Math.max(1.2, R * 0.2);
      add(z, `<path d="${d}" fill="url(#${gid})" filter="${modeller(`l_${f(sg)}`, sg, [0.7, 0.77, 0.84, 0.72, 1])}"/>`);
      if (R >= 11) {
        add(
          z,
          `<path d="M${pl(0.26 * L, 0)}L${pl(0.64 * L, 0)}" stroke="#000" stroke-opacity="0.4" stroke-width="${f(Math.max(1.1, R * 0.07))}" stroke-linecap="round" fill="none"/>`,
        );
      }
    }
    // the eye: a shallow cup, a bead, and on larger flowers a ring of smaller beads
    const pc = place(cx, cy, 0, m);
    const eye = Math.max(1.5, R * 0.13);
    add(z, `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(Math.max(2.4, R * 0.26))}" fill="#000" fill-opacity="0.3"/>`);
    add(z, `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(eye)}" fill="${grey(1)}"/>`);
    const n = R >= 16 ? 8 : R >= 11.5 ? 6 : 0;
    for (let i = 0; i < n; i++) {
      const a = rad(rot + 20 + (i * 360) / n);
      const rr = R * 0.3;
      const [bx, by] = pc(Math.cos(a) * rr, Math.sin(a) * rr).split(' ');
      add(z, `<circle cx="${bx}" cy="${by}" r="${f(Math.max(1.05, R * 0.058))}" fill="${grey(0.95)}"/>`);
    }
  }

  /**
   * A full garden rose seen from the front, R to its outermost petal tips. The petals are set
   * the way a rose sets them, each a little over a third of a turn on from the last and a
   * little further in, so no two rims fall on the same line; every petal has a turned-back
   * lip, is cupped behind it, and stands a step higher than the one beneath, up to a furled heart.
   */
  function rose(cx, cy, R, o = {}) {
    const { rot = -100, seed = 8, z = 4, lowest = 0.42, highest = 1, lip = 0.13, cup = 0.48, reach: rr0 = 0.13, cut = 0.4, folds = 0 } = o;
    const r = rng(seed);
    // radius (of R), half-width in degrees and how much the rim dips toward its ends
    const whorls = [
      [1.0, 50, 0.42], [0.98, 52, 0.42], [0.96, 50, 0.42],
      [0.9, 53, 0.42], [0.87, 54, 0.42], [0.84, 54, 0.42],
      [0.74, 57, 0.4], [0.71, 58, 0.4], [0.68, 58, 0.4],
      [0.57, 63, 0.38], [0.54, 65, 0.38], [0.51, 66, 0.38],
      [0.4, 76, 0.34], [0.37, 80, 0.34], [0.34, 84, 0.32],
      [0.25, 104, 0.28], [0.18, 124, 0.24], [0.115, 150, 0.2],
    ];
    const n = whorls.length;
    whorls.forEach(([rho, half, dip], k) => {
      const theta = rot + k * 137.5 + (r() - 0.5) * 10;
      const rk = R * rho * (1 + (r() - 0.5) * 0.04);
      const hk = lowest + (highest - lowest) * Math.pow(k / (n - 1), 0.85);
      const phase = r() * 6.28;
      const ruffle = k < 12 ? 0.022 : 0.01;
      const steps = 26;
      // the outline, drawn in by `inset` (of the radius) at the middle of the rim and by nothing at its ends
      const outline = (inset) => {
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const u = (i / steps) * 2 - 1;
          const rr =
            rk *
            (1 - dip * Math.pow(Math.abs(u), 2.6)) *
            (1 + ruffle * Math.sin(u * 7 + phase) + 0.03 * Math.exp(-(u * u) / 0.05)) *
            (1 - inset * Math.pow(1 - u * u, 0.7));
          const a = rad(theta + u * half);
          pts.push(`${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`);
        }
        return `M${f(cx)} ${f(cy)}L${pts.join('L')}Z`;
      };
      const d = outline(0);
      // a groove cut into the petal beneath, the turned-back lip, then the cup behind it
      add(z, `<path d="${d}" stroke="#000" stroke-opacity="${f(cut)}" stroke-width="2" stroke-linejoin="round" fill="none"/>`);
      const turned = k < 12 ? lip * (0.7 + r() * 0.6) : 0;
      if (turned) {
        add(z, `<path d="${d}" fill="${grey(hk)}"/>`);
        add(z, `<path d="${outline(turned)}" fill="${grey(hk * 0.9)}" filter="${bowl(Math.max(1.3, rk * rr0), cup)}"/>`);
      } else {
        add(z, `<path d="${d}" fill="${grey(hk)}" filter="${bowl(Math.max(1.3, rk * rr0), cup)}"/>`);
      }
      // the fold that runs in from the point of an outer petal
      if (k < folds) {
        const a = rad(theta + (r() - 0.5) * 8);
        const at = (q) => `${f(cx + Math.cos(a) * rk * q)} ${f(cy + Math.sin(a) * rk * q)}`;
        add(z, `<path d="M${at(0.99)}L${at(0.74)}" stroke="#000" stroke-opacity="0.26" stroke-width="1.2" stroke-linecap="round" fill="none"/>`);
      }
    });
    add(z, `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 0.06)}" fill="${grey(1)}"/>`);
  }

  const drop = (pl, len, hw) =>
    `M${pl(0, 0)}C${pl(0.16 * len, -hw * 1.05)} ${pl(0.6 * len, -hw * 0.95)} ${pl(len, 0)}C${pl(0.6 * len, hw * 0.95)} ${pl(0.16 * len, hw * 1.05)} ${pl(0, 0)}Z`;

  const sepalPair = (x, y, a, len, z, flare = 50) => {
    for (const sd of [-1, 1]) {
      const m = sweep(x, y, rad(a + sd * flare), len, -sd * rad(64));
      add(z, `<path d="${taper(m, (t) => 2.1 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.88 + 0.12)), 0.75), 9)}" fill="${grey(0.6)}"/>`);
    }
  };

  /**
   * A closed bud at (x, y) pointing along `a` (degrees): a plump teardrop in a little calyx
   * cup, with two sepals flaring from under it.
   */
  function bud(x, y, a, len, o = {}) {
    const { wid = len * 0.58, h = 0.9, z = 3, calyx = len >= 8.5 } = o;
    const pl = place(x, y, rad(a));
    sepalPair(x, y, a, len * 0.72, z);
    add(z, `<path d="${drop(pl, len, wid * 0.66)}" fill="${grey(h)}" filter="${dome(Math.max(1, wid * 0.3), 0.55)}"/>`);
    if (calyx) {
      const cl = len * 0.36;
      const cw = wid * 0.5;
      const cup =
        `M${pl(-0.4, 0)}C${pl(0, -cw * 1.1)} ${pl(cl * 0.7, -cw * 1.15)} ${pl(cl, -cw * 0.8)}` +
        `Q${pl(cl * 0.72, 0)} ${pl(cl, cw * 0.8)}C${pl(cl * 0.7, cw * 1.15)} ${pl(0, cw * 1.1)} ${pl(-0.4, 0)}Z`;
      add(z, `<path d="${cup}" stroke="#000" stroke-opacity="0.36" stroke-width="1.6" fill="none"/>`);
      add(z, `<path d="${cup}" fill="${grey(0.72)}"/>`);
    }
  }

  /** A bud that has begun to open at (x, y) along `a` (degrees): three petals parting above the sepals. */
  function opening(x, y, a, len, o = {}) {
    const { h = 0.82, z = 3, fan = 24 } = o;
    sepalPair(x, y, a, len * 0.6, z, 62);
    for (const k of [-1, 1, 0]) {
      const d = drop(place(x, y, rad(a + k * fan)), len * (k ? 0.9 : 1), len * (k ? 0.3 : 0.34));
      add(z, `<path d="${d}" stroke="#000" stroke-opacity="0.7" stroke-width="2.2" fill="none"/>`);
      add(z, `<path d="${d}" fill="${grey(h)}" filter="${dome(Math.max(1, len * 0.16), 0.5)}"/>`);
    }
  }

  /** A seed head: a hair-fine stalk from (x, y) along `a` (degrees) that parts into three, a bead on each. */
  function seeds(x, y, a, len, o = {}) {
    const { r = 1.7, fan = 30, z = 2, n = 3 } = o;
    const st = sweep(x, y, rad(a), len * 0.5, o.bend ?? 0);
    stem(st, 1.0, 0.9, { h: 0.42, z });
    const [fx, fy] = st.at(1);
    const fa = deg(st, 1);
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      const c = sweep(fx, fy, rad(fa + k * fan), len * (0.5 - 0.1 * Math.abs(k)), k * 0.3);
      stem(c, 0.95, 0.9, { h: 0.42, z });
      const [bx, by] = c.at(1);
      bead(bx, by, r * (1 - 0.12 * Math.abs(k)), { h: 0.95 });
    }
  }

  // ---- growing things from a stem -------------------------------------------------------------

  /**
   * The light falls along one diagonal of the sheet (and along the other in the mirrored
   * pictures), and a leaf lying along the light has no lit and no shaded side: it all but
   * vanishes. So a leaf that would lie within `clear` degrees of a diagonal is turned off it.
   */
  function steer(a, clear = 27, open = 0) {
    const off = (((a % 90) + 90) % 90) - 45; // -45..45: how far the angle is from the nearest diagonal
    if (Math.abs(off) >= clear) return a;
    // `open` (+1 or -1) is the way that opens the leaf out from its stem: preferred when given
    if (open) return a - off + open * clear;
    return a + (off >= 0 ? clear - off : -clear - off);
  }

  /** A leaf growing from `curve` at t, on side +1 (right of the direction of growth) or -1. */
  function leafAt(curve, t, side, len, wid, o = {}) {
    const { spread = 50, curl = 0.3, free = false } = o;
    const [x, y] = curve.at(t);
    const j = 1 + (wobble() - 0.5) * 0.1;
    // curl > 0 turns the leaf back toward the direction the stem grows
    const bend = -side * (curl + (wobble() - 0.5) * 0.16);
    const along = deg(curve, t);
    let a = along + side * spread;
    if (!free) {
      // turned off the diagonal by opening out from the stem, unless that would lay the leaf
      // back past square to it, in which case it closes up instead
      const halfTurn = ((bend / 2) * 180) / Math.PI;
      const opened = steer(a + halfTurn, 27, side);
      a = (Math.abs(opened - along) <= (o.widest ?? 82) ? opened : steer(a + halfTurn, 27, -side)) - halfTurn;
    }
    // the node the leaf springs from: a slight knot on the stem, which shows even where the
    // stem itself runs along the light and is lost
    if (o.node ?? nodes) add(2.5, `<circle cx="${f(x)}" cy="${f(y)}" r="${f(o.nodeR ?? 1.35)}" fill="${grey(0.7)}"/>`);
    return leaf(x, y, a, len * j, wid * j, { bend, ...o });
  }

  /** A rose leaf growing from `curve` at t on `side`; broad enough to need less turning off the light. */
  function roseLeafAt(curve, t, side, len, wid, o = {}) {
    const { spread = 55, curl = 0.25 } = o;
    const [x, y] = curve.at(t);
    const bend = -side * curl;
    const halfTurn = ((bend / 2) * 180) / Math.PI;
    const a = steer(deg(curve, t) + side * spread + halfTurn, 24, side) - halfTurn;
    return roseLeaf(x, y, a, len, wid, { bend, teeth: Math.max(4, Math.round(len / 3.6)), veins: len >= 17 ? 3 : 2, ...o });
  }

  /**
   * A side stem from `curve` at t to the point `to`; returns its line, so more can grow from
   * it. It leaves at `spread` degrees from the parent (or heading `leave`, in degrees on the
   * sheet) and arrives heading `arrive`.
   */
  function twigTo(curve, t, side, to, o = {}) {
    const { spread = 40, w0 = 1.15, w1 = 0.85, h = 0.42, z = 2, pull = 0.36 } = o;
    const p = curve.at(t);
    const a0 = o.leave ?? deg(curve, t) + side * spread;
    const straight = (Math.atan2(to[1] - p[1], to[0] - p[0]) * 180) / Math.PI;
    const c = reach(p, to, a0, o.arrive ?? straight - (a0 - straight) * 0.6, pull);
    return stem(c, w0, w1, { h, z });
  }

  /**
   * Puts a blossom on the end of a stalk, its centre `sit` radii beyond the tip. `collar`
   * ([length, width]) tucks a pair of small leaves under it.
   */
  function blossomOn(curve, R, o = {}) {
    const [x, y] = curve.at(1);
    const a = curve.heading(1);
    const d = R * (o.sit ?? 0.9);
    if (o.collar) {
      const t = 1 - (R * 0.35) / Math.max(1, curve.length);
      for (const sd of [-1, 1]) leafAt(curve, t, sd, o.collar[0], o.collar[1], { spread: 66, curl: 0.15 });
    }
    // `tilt` < 1 turns the flower's face a little up its stalk, so it is seen slightly from below
    const turned = o.tilt ? { squash: o.tilt, lean: deg(curve, 1) } : {};
    blossom(x + Math.cos(a) * d * (o.tilt ?? 1), y + Math.sin(a) * d * (o.tilt ?? 1), R, { rot: deg(curve, 1) + 36, ...turned, ...o });
  }

  /** Puts a bud, or with `open` an opening bud, on the end of a stalk. */
  function budOn(curve, len, o = {}) {
    const [x, y] = curve.at(1);
    (o.open ? opening : bud)(x, y, deg(curve, 1) + (o.turn ?? 0), len, o);
  }

  /** Puts a seed head on the end of a stalk. */
  function seedsOn(curve, len, o = {}) {
    const [x, y] = curve.at(1);
    seeds(x, y, deg(curve, 1) + (o.turn ?? 0), len, o);
  }

  function svg() {
    const sorted = [...items].sort((p, q) => p.z - q.z || p.i - q.i);
    return `<defs>${defs.join('')}</defs>` + sorted.map((it) => it.s).join('');
  }

  return {
    // lines
    through, sweep, reach, part, deg, atY,
    // the vocabulary
    stem, leaf, roseLeaf, bead, blossom, rose, bud, opening, seeds,
    // growing things from a stem
    leafAt, roseLeafAt, twigTo, blossomOn, budOn, seedsOn,
    // raw markup at a given depth, and the finished drawing
    add, svg,
  };
}
