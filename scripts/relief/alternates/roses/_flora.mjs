// Shared drawing of floral set "b": the Damask rose (ward jouri).
//
// Everything here paints a HEIGHT MAP: black is the paper, white the highest point.
// A piece makes a studio, calls the flower / bud / leaf / stem functions on it and returns
// studio.markup(). All coordinates are design pixels of the piece; nothing is transformed,
// so gradients can be placed exactly.

const TAU = Math.PI * 2;
const GOLDEN = (137.508 * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const polar = (c, a, r) => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
const deg = (d) => (d * Math.PI) / 180;

/**
 * A studio collects markup in layers (z) and owns the <defs> of one piece.
 * `ctx` is what the renderer hands to draw(); `name` prefixes every id.
 */
export function studio(ctx, name) {
  const { f, grey, W, H } = ctx;
  const defs = [];
  const items = [];
  const blurs = new Map();
  let n = 0;
  const uid = (k) => `${name}-${k}${(n++).toString(36)}`;
  const stopsOf = (stops) =>
    stops
      .map(([o, v, a]) => `<stop offset="${f(o)}" stop-color="${grey(v)}"${a === undefined ? '' : ` stop-opacity="${f(a)}"`}/>`)
      .join('');
  const S = {
    ctx,
    f,
    grey,
    W,
    H,
    /** every outline point drawn, for checking a composition against its allowed area */
    points: [],
    /** adds markup to the drawing; higher z lies over lower, and within one z later lies over earlier */
    put(markup, z = 0) {
      items.push({ z, i: items.length, markup });
    },
    /** a path from points, straight segments */
    line(pts, close = true) {
      return 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + (close ? 'Z' : '');
    },
    /** a smooth path through points (Catmull-Rom) */
    smooth(pts, close = true, k = 1 / 6) {
      const m = pts.length;
      const P = (i) => (close ? pts[(i + m) % m] : pts[clamp(i, 0, m - 1)]);
      let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
      const segs = close ? m : m - 1;
      for (let i = 0; i < segs; i++) {
        const p0 = P(i - 1);
        const p1 = P(i);
        const p2 = P(i + 1);
        const p3 = P(i + 2);
        d +=
          `C${f(p1[0] + (p2[0] - p0[0]) * k)} ${f(p1[1] + (p2[1] - p0[1]) * k)} ` +
          `${f(p2[0] - (p3[0] - p1[0]) * k)} ${f(p2[1] - (p3[1] - p1[1]) * k)} ${f(p2[0])} ${f(p2[1])}`;
      }
      return d + (close ? 'Z' : '');
    },
    linear(p0, p1, stops) {
      const id = uid('l');
      defs.push(
        `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(p0[0])}" y1="${f(p0[1])}" x2="${f(p1[0])}" y2="${f(p1[1])}">${stopsOf(stops)}</linearGradient>`,
      );
      return `url(#${id})`;
    },
    radial(c, r, stops, focus) {
      const id = uid('r');
      const fo = focus ? ` fx="${f(focus[0])}" fy="${f(focus[1])}"` : '';
      defs.push(
        `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}"${fo}>${stopsOf(stops)}</radialGradient>`,
      );
      return `url(#${id})`;
    },
    /** a blur of `sigma` design px that works on heights (sRGB), reaching well beyond the shape */
    blur(sigma) {
      const key = f(sigma);
      if (!blurs.has(key)) {
        const id = uid('b');
        defs.push(
          `<filter id="${id}" filterUnits="userSpaceOnUse" x="-40" y="-40" width="${W + 80}" height="${H + 80}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${key}"/></filter>`,
        );
        blurs.set(key, `url(#${id})`);
      }
      return blurs.get(key);
    },
    clip(d) {
      const id = uid('c');
      defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
      return `url(#${id})`;
    },
    /** The finished drawing. `relief` (0..1) presses the whole of it lower: every height is multiplied by it. */
    markup(relief = 1) {
      items.sort((a, b) => a.z - b.z || a.i - b.i);
      const art = items.map((x) => x.markup).join('');
      return `<defs>${defs.join('')}</defs>` + (relief < 1 ? `<g opacity="${f(relief)}">${art}</g>` : art);
    },
  };
  return S;
}

/** A smooth curve through points, with at(t) and heading(t) like the kit's cubic. */
export function spline(pts) {
  const m = pts.length;
  const P = (i) => pts[clamp(i, 0, m - 1)];
  const seg = (t) => {
    const x = clamp(t, 0, 1) * (m - 1);
    const i = Math.min(m - 2, Math.floor(x));
    return [i, x - i];
  };
  const ctrl = (i) => {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    return [p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2];
  };
  const at = (t) => {
    const [i, u] = seg(t);
    const [a, b, c, d] = ctrl(i);
    const v = 1 - u;
    return [0, 1].map((k) => v * v * v * a[k] + 3 * v * v * u * b[k] + 3 * v * u * u * c[k] + u * u * u * d[k]);
  };
  const heading = (t) => {
    const [i, u] = seg(t);
    const [a, b, c, d] = ctrl(i);
    const v = 1 - u;
    const s = [0, 1].map((k) => 3 * v * v * (b[k] - a[k]) + 6 * v * u * (c[k] - b[k]) + 3 * u * u * (d[k] - c[k]));
    return Math.atan2(s[1], s[0]);
  };
  return { at, heading };
}

// ---------------------------------------------------------------------------------------------
// The rose seen from above. Petals are set round the heart by the golden angle, as on the
// living flower, in rings that grow smaller and stand higher toward the middle. Each petal is
// a scoop: its floor lies low and rises to a rolled lip, so every lip throws a line of light
// and a line of shade.

/** Ring plans by size: n petals, r lip radius (of R), w half-angle in degrees. */
function ringPlan(R) {
  if (R >= 26)
    return [
      { n: 5, r: 1.0, w: 50 },
      { n: 5, r: 0.81, w: 50 },
      { n: 6, r: 0.65, w: 48 },
      { n: 6, r: 0.52, w: 50 },
      { n: 5, r: 0.4, w: 56 },
      { n: 4, r: 0.3, w: 66, back: 0.12 },
      { n: 3, r: 0.2, w: 86, back: 0.22 },
      { n: 1, r: 0.11, w: 125, back: 0.3 },
    ];
  if (R >= 15)
    return [
      { n: 5, r: 1.0, w: 50 },
      { n: 5, r: 0.77, w: 52 },
      { n: 4, r: 0.56, w: 60 },
      { n: 3, r: 0.37, w: 78, back: 0.15 },
      { n: 2, r: 0.2, w: 110, back: 0.3 },
    ];
  if (R >= 12.5)
    return [
      { n: 5, r: 1.0, w: 46, even: true },
      { n: 4, r: 0.68, w: 60 },
      { n: 3, r: 0.4, w: 84, back: 0.2 },
    ];
  if (R >= 8.5)
    return [
      { n: 5, r: 1.0, w: 44, even: true },
      { n: 3, r: 0.56, w: 84, back: 0.15 },
    ];
  return [{ n: 5, r: 1.0, w: 42, even: true }];
}

/** The outline of one petal as points: a fan from its root with a full, rounded lip. */
function petalPoints(c, sp) {
  const pts = [c];
  const N = Math.max(10, Math.ceil((sp.r * sp.w * 2) / 1.1));
  for (let i = 0; i <= N; i++) {
    const s = -1 + (2 * i) / N;
    const ss = clamp(s - sp.skew * (1 - s * s), -1, 1);
    let fr = Math.pow(Math.max(0, Math.cos((s * Math.PI) / 2)), sp.shoulder);
    fr *= 1 + sp.nick * Math.exp(-((ss / 0.17) ** 2));
    fr *= 1 + sp.wave * Math.sin(ss * 2.3 * Math.PI + sp.ph1) + sp.wave * 0.6 * Math.sin(ss * 4.1 * Math.PI + sp.ph2);
    pts.push(polar(c, sp.th + sp.side * s * sp.w, sp.r * fr));
  }
  return pts;
}

function drawPetal(S, c, sp, z) {
  const { f, grey } = S;
  const pts = petalPoints(c, sp);
  S.points.push(...pts);
  const d = S.line(pts);
  const lipD = S.line(pts.slice(1), false);
  // the floor of the petal: a scoop, a little lower on the side that goes under its neighbour
  const t = [Math.sin(sp.th) * sp.side, -Math.cos(sp.th) * sp.side];
  const mid = polar(c, sp.th, sp.r * 0.7);
  const half = sp.r * Math.sin(Math.min(sp.w, 1.4)) * 0.8;
  const v = sp.lip - sp.drop;
  const floor = S.linear(
    [mid[0] - t[0] * half, mid[1] - t[1] * half],
    [mid[0] + t[0] * half, mid[1] + t[1] * half],
    [
      [0, v - sp.lean],
      [1, v + sp.lean],
    ],
  );
  // on the broad outer petals, a soft crease down the middle of the scoop
  let crease = '';
  if (sp.crease) {
    const a0 = polar(c, sp.th - sp.side * sp.w * sp.skew * 0.6, sp.r * 0.45);
    const a1 = polar(c, sp.th - sp.side * sp.w * sp.skew * 0.3, sp.r * 0.9);
    crease = `<path d="M${f(a0[0])} ${f(a0[1])}L${f(a1[0])} ${f(a1[1])}" fill="none" stroke="#000" stroke-opacity="${f(sp.crease)}" stroke-width="${f(sp.reach * 0.8)}" stroke-linecap="round" filter="${S.blur(sp.soft * 0.55)}"/>`;
  }
  S.put(
    `<g clip-path="${S.clip(d)}">` +
      `<path d="${d}" fill="${floor}"/>` +
      crease +
      // the petal rises to its free edge: a soft slope, then the rolled lip itself
      `<path d="${lipD}" fill="none" stroke="${grey(sp.lip)}" stroke-width="${f(sp.reach * 2)}" stroke-linejoin="round" filter="${S.blur(sp.soft)}"/>` +
      `<path d="${lipD}" fill="none" stroke="${grey(sp.lip + sp.rimUp)}" stroke-width="${f(sp.rim * 2)}" stroke-linejoin="round"/>` +
      `</g>`,
    z,
  );
}

/**
 * A full Damask rose seen from above, centred on c with outer radius R (design px). The number
 * of rings follows the size: some thirty-five petals at R 26 and over, five round a button under 8.5.
 * o: seed, rot (radians), spin (+1 / -1 winding), z (layer), height (scales every height),
 *    ruffle (how wavy the lips are, 1 = usual), loose (guard petals fallen back beyond R),
 *    shift ([dx, dy] by which the heart sits off centre), drop, rimUp, crease, plan (to override)
 */
export function rose(S, c, R, o = {}) {
  const rnd = S.ctx.rng(o.seed ?? 7);
  const rot = o.rot ?? rnd() * TAU;
  const spin = o.spin ?? (rnd() < 0.5 ? -1 : 1);
  const z = o.z ?? 10;
  const k = (o.height ?? 1) * clamp(0.66 + R / 70, 0.76, 1);
  const plan = o.plan ?? ringPlan(R);
  const ruffle = o.ruffle ?? 1;
  const lean = rnd() * TAU;
  const shift = o.shift ?? [Math.cos(lean) * R * 0.05, Math.sin(lean) * R * 0.05];

  // whatever lies beneath sinks toward the flower, so leaves and stems read as going under it
  S.put(
    `<circle cx="${S.f(c[0])}" cy="${S.f(c[1])}" r="${S.f(R * 0.98)}" fill="#000" fill-opacity="0.55" filter="${S.blur(Math.max(1.2, R * 0.09))}"/>`,
    z,
  );

  // a full-blown flower lets one or two of its guard petals fall back, lower and further out
  for (let j = 0; j < (o.loose ?? 0); j++) {
    const th = rot + spin * (j * 2.4 + 0.9) * GOLDEN + (rnd() - 0.5) * 0.3;
    const r = R * (1.07 + rnd() * 0.06);
    drawPetal(
      S,
      c,
      {
        th,
        r,
        w: deg(40 + rnd() * 8),
        side: spin,
        skew: 0.1,
        shoulder: 0.26 + rnd() * 0.08,
        nick: rnd() < 0.5 ? -0.04 : 0.03,
        wave: 0.02 * ruffle,
        ph1: rnd() * TAU,
        ph2: rnd() * TAU,
        lip: 0.3 * k,
        drop: 0.18 * k,
        lean: 0.03 * k,
        reach: 2.2,
        soft: 1.6,
        rim: 1,
        rimUp: 0.07 * k,
        crease: 0.2,
      },
      z,
    );
  }

  let m = 0;
  plan.forEach((ring, i) => {
    const outer = i === 0;
    const u = plan.length > 1 ? i / (plan.length - 1) : 0;
    const lip = lerp(0.42, [0.42, 0.42, 0.74, 0.84, 0.9, 0.95][Math.min(plan.length, 5)], u) * k;
    // the width of petal that shows between this ring's lip and the next ring's
    const band = R * (ring.r - (i < plan.length - 1 ? plan[i + 1].r : ring.r * 0.3));
    const start = rot + spin * m * GOLDEN;
    for (let j = 0; j < ring.n; j++, m++) {
      const th = (ring.even ? start + (spin * j * TAU) / ring.n : rot + spin * m * GOLDEN) + (rnd() - 0.5) * 0.22;
      const r = R * ring.r * (1 + (rnd() - 0.5) * (outer ? 0.12 : 0.1));
      const kind = rnd();
      const sp = {
        th,
        r: r * (1 + (ring.back ?? 0)),
        w: deg(ring.w) * (1 + (rnd() - 0.5) * 0.16),
        side: spin,
        skew: 0.1 + rnd() * 0.12,
        shoulder: (outer ? 0.24 : 0.3) + rnd() * 0.1,
        // some lips are nicked like a heart, some come to a soft point
        nick: !outer && i > 2 ? 0 : kind < 0.35 ? -(0.025 + rnd() * 0.035) : kind < 0.6 ? 0.03 + rnd() * 0.03 : 0,
        wave: (outer ? 0.02 : 0.013) * (0.5 + rnd()) * ruffle,
        ph1: rnd() * TAU,
        ph2: rnd() * TAU,
        lip,
        drop: (o.drop ?? 0.3) * k,
        lean: 0.035 * k,
        reach: clamp(band * 0.3, 0.9, 2.6),
        soft: clamp(band * 0.24, 0.7, 2),
        rim: clamp(band * 0.14, 0.6, 1.1),
        rimUp: (o.rimUp ?? 0.1) * k,
        crease: band >= 5.2 ? (o.crease ?? 0.22) : 0,
      };
      // inner petals root a little behind the heart, so their lips wind instead of ringing it
      const cc = [c[0] + shift[0] * (1 - ring.r), c[1] + shift[1] * (1 - ring.r)];
      drawPetal(S, polar(cc, th + Math.PI, r * (ring.back ?? 0)), sp, z);
    }
  });

  const hc = [c[0] + shift[0], c[1] + shift[1]];
  if (plan.length === 1) {
    // the smallest blossoms: five petals round a raised button
    const rb = R * 0.3;
    S.put(
      `<circle cx="${S.f(hc[0])}" cy="${S.f(hc[1])}" r="${S.f(rb)}" fill="${S.radial(hc, rb, [[0, 0.95 * k], [0.55, 0.9 * k], [1, 0.62 * k]])}"/>`,
      z,
    );
    return;
  }
  // the heart of the flower: a pit between the innermost lips
  const rc = R * plan[plan.length - 1].r * 0.34;
  if (rc > 0.7) S.put(`<circle cx="${S.f(hc[0])}" cy="${S.f(hc[1])}" r="${S.f(rc)}" fill="${S.grey(0.5 * k)}"/>`, z);
}

// ---------------------------------------------------------------------------------------------
// Leaves. A rose leaf is three or five toothed leaflets on a thin stalk; each leaflet swells
// either side of a cut-in midrib and carries side veins running out to its teeth.

/**
 * One leaflet from `base` along `ang` (radians), `L` long. It is drawn in one of three manners:
 *   full   (L from 8.5, or o.full) a toothed blade folded along its midrib, veins and midrib cut
 *          in, the margin turned up a little so the whole outline reads;
 *   dish   (o.plain, or under 8.5) drawn in line as a die-sinker would: a raised margin round a
 *          sunk blade, and a raised midrib;
 *   solid  (the very smallest) a slender raised almond with its midrib cut in.
 * o: width (half-width), bend (sideways bow as a fraction of L), top (height), fold, rim, rimW,
 *    z, plain, full, style ('dish' | 'solid'), blade and rimH (heights of the dish manner)
 */
export function leaflet(S, base, ang, L, o = {}) {
  const { f } = S;
  const small = o.plain || (L < 8.5 && !o.full);
  const Wd = o.width ?? L * (small ? 0.2 : 0.285);
  const bend = o.bend ?? 0;
  const z = o.z ?? 4;
  const top = o.top ?? (small ? 0.5 : 0.58);
  const a = [Math.cos(ang), Math.sin(ang)];
  const n = [-a[1], a[0]];
  const at = (t) => {
    const b = bend * L * 4 * t * (1 - t);
    return [base[0] + a[0] * L * t + n[0] * b, base[1] + a[1] * L * t + n[1] * b];
  };
  const heading = (t) => {
    const b = bend * L * 4 * (1 - 2 * t);
    return Math.atan2(a[1] * L + n[1] * b, a[0] * L + n[0] * b);
  };
  // the outline: widest at `belly`, drawn out to a point; `sharp` sets how quickly it narrows
  const tm = o.belly ?? (small ? 0.44 : 0.4);
  const K = o.sharp ?? (small ? 2.3 : 1.9);
  const shape = (t) => Math.pow(t / tm, tm * K) * Math.pow((1 - t) / (1 - tm), (1 - tm) * K);
  const edge = (t, sgn, extra = 0, part = 1) => {
    const p = at(t);
    const h = heading(t) + (sgn * Math.PI) / 2;
    const w = (Wd * shape(t) + extra) * part;
    return [p[0] + Math.cos(h) * w, p[1] + Math.sin(h) * w];
  };
  const T = !small && L >= 8.5 ? clamp(Math.round(L / 2.8), 3, 9) : 0; // teeth along each side
  const depth = clamp(Wd * 0.2, 0.5, 1.5);
  const side = (sgn) => {
    const pts = [];
    if (!T) {
      for (let i = 1; i < 12; i++) pts.push(edge(i / 12, sgn));
      return pts;
    }
    for (let q = 0; q < T; q++) {
      const t0 = q / T;
      const t1 = (q + 1) / T;
      const dd = depth * Math.pow(shape((t0 + t1) / 2), 0.7);
      if (q > 0) pts.push(edge(t0, sgn)); // the notch
      pts.push(edge(lerp(t0, t1, 0.5), sgn, dd * 0.55));
      if (q < T - 1) pts.push(edge(lerp(t0, t1, 0.9), sgn, dd)); // the tooth, turned toward the tip
    }
    return pts;
  };
  const outline = [base, ...side(1), at(1), ...side(-1).reverse()];
  S.points.push(...outline);
  const d = S.line(outline);
  const made = { tip: at(1), at, heading };

  const hd = heading(0.5);
  const nr = [Math.cos(hd + Math.PI / 2), Math.sin(hd + Math.PI / 2)];
  const m = at(0.5);
  const across = (stops) => S.linear([m[0] - nr[0] * Wd, m[1] - nr[1] * Wd], [m[0] + nr[0] * Wd, m[1] + nr[1] * Wd], stops);

  if (small && (o.style ?? (L >= 8.5 ? 'dish' : 'solid')) === 'dish') {
    const rib = { at: (t) => at(0.04 + t * 0.86), heading: (t) => heading(0.04 + t * 0.86) };
    S.put(
      `<path d="${d}" fill="${S.grey(o.blade ?? 0.2)}" stroke="${S.grey(o.rimH ?? 0.66)}" stroke-width="${f((o.rimW ?? 0.9) * 2)}" stroke-linejoin="round" paint-order="stroke"/>` +
        `<path d="${S.ctx.taper(rib, (t) => lerp(1.1, 0.7, t), 8)}" fill="${S.grey(o.rimH ?? 0.66)}"/>`,
      z,
    );
    return made;
  }
  if (small) {
    let g = `<path d="${d}" fill="${across([[0, top + 0.05], [1, top - 0.05]])}"/>`;
    if (L >= 7) {
      const rib = { at: (t) => at(0.06 + t * 0.8), heading: (t) => heading(0.06 + t * 0.8) };
      g += `<path d="${S.ctx.taper(rib, (t) => lerp(0.95, 0.5, t), 8)}" fill="#000" fill-opacity="0.45"/>`;
    }
    S.put(g, z);
    return made;
  }

  // The blade is folded along its midrib like a shallow V: the half turned from the light lies
  // in soft shade and the other catches it, so the whole leaf shows even where no edge casts.
  const fold = o.fold ?? 0.26;
  const fill = across([[0, top * 0.9], [0.14, top], [0.5, top - fold], [0.86, top], [1, top * 0.9]]);
  const rib = { at: (t) => at(t * 0.95), heading: (t) => heading(t * 0.95) };
  let g = `<g clip-path="${S.clip(d)}"><path d="${d}" fill="${fill}"/>`;
  // side veins, running forward to the teeth
  const nv = T ? clamp(Math.round(L / 3.6), 2, 6) : 0;
  for (let i = 0; i < nv; i++) {
    const ts = lerp(0.13, 0.74, nv > 1 ? i / (nv - 1) : 0.5);
    const te = Math.min(0.96, ts + 0.2);
    for (const sgn of [1, -1]) {
      const p = at(ts);
      const e = edge(te, sgn, 0, 0.88);
      const q = edge(lerp(ts, te, 0.42), sgn, 0, 0.5);
      g += `<path d="M${f(p[0])} ${f(p[1])}Q${f(q[0])} ${f(q[1])} ${f(e[0])} ${f(e[1])}" fill="none" stroke="#000" stroke-opacity="0.42" stroke-width="${f(clamp(L * 0.05, 0.8, 1.1))}" stroke-linecap="round"/>`;
    }
  }
  // the midrib, cut in
  g += `<path d="${S.ctx.taper(rib, (t) => lerp(clamp(L * 0.075, 0.9, 1.5), 0.5, t), 10)}" fill="#000" fill-opacity="0.52"/>`;
  // the margin turned up a little all round, so the outline reads on the lit side too
  const rim = o.rim ?? 0.14;
  if (rim) g += `<path d="${d}" fill="none" stroke="${S.grey(top + rim)}" stroke-width="${f((o.rimW ?? 1) * 2)}" stroke-linejoin="round"/>`;
  g += `</g>`;
  S.put(g, z);
  return made;
}

/**
 * A compound rose leaf from `base` along `ang`, `len` long overall.
 * o: n (3, 5 or 7 leaflets), seed, bow (sideways bow of the stalk), z, top
 */
export function leaf(S, base, ang, len, o = {}) {
  const rnd = S.ctx.rng(o.seed ?? 3);
  const n = o.n ?? 5;
  const z = o.z ?? 4;
  const bow = o.bow ?? (rnd() - 0.5) * 0.3;
  const Lt = len * (n === 3 ? 0.52 : n === 5 ? 0.44 : 0.37);
  const Lr = len - Lt;
  const a = [Math.cos(ang), Math.sin(ang)];
  const nr = [-a[1], a[0]];
  const end = [base[0] + a[0] * Lr + nr[0] * bow * Lr, base[1] + a[1] * Lr + nr[1] * bow * Lr];
  const stalk = S.ctx.cubic(
    base,
    [base[0] + a[0] * Lr * 0.4, base[1] + a[1] * Lr * 0.4],
    [base[0] + a[0] * Lr * 0.75 + nr[0] * bow * Lr * 0.55, base[1] + a[1] * Lr * 0.75 + nr[1] * bow * Lr * 0.55],
    end,
  );
  const w0 = clamp(len * 0.032, 0.9, 1.3);
  S.put(`<path d="${S.ctx.taper(stalk, (t) => lerp(w0, w0 * 0.75, t), 14)}" fill="${S.grey(0.52)}"/>`, z - 1);
  const pairs = n === 3 ? [0.52] : n === 5 ? [0.3, 0.72] : [0.22, 0.5, 0.78];
  // a small leaf is drawn all in one manner: every leaflet in line, margin and midrib raised
  const manner = Lt < 10.4 ? { plain: true, style: 'dish', rimW: 0.75 } : { full: true };
  pairs.forEach((t, q) => {
    const p = stalk.at(t);
    const hd = stalk.heading(t);
    const grow = pairs.length > 1 ? q / (pairs.length - 1) : 1;
    const size = Lt * lerp(0.78, 0.92, grow);
    for (const sgn of [-1, 1]) {
      const spread = deg(lerp(62, 52, grow) + (rnd() - 0.5) * 10);
      leaflet(S, p, hd + sgn * spread, size * (0.93 + rnd() * 0.14), {
        bend: -sgn * (0.03 + rnd() * 0.04),
        top: o.top,
        z,
        ...manner,
      });
    }
  });
  leaflet(S, end, stalk.heading(1) + (rnd() - 0.5) * 0.2, Lt, { bend: (rnd() - 0.5) * 0.1, top: o.top, z, ...manner });
  return stalk;
}

// ---------------------------------------------------------------------------------------------
// Buds and stems.

/** The frame of a bud or flower seen from the side: u runs up its axis, v across, both in units of L. */
function sideFrame(base, ang, L, mir) {
  const a = [Math.cos(ang), Math.sin(ang)];
  const n = [-a[1] * mir, a[0] * mir];
  const P = (u, v) => [base[0] + (a[0] * u + n[0] * v) * L, base[1] + (a[1] * u + n[1] * v) * L];
  return { P, Q: (list) => list.map(([u, v]) => P(u, v)) };
}

/** The hip under a bud: a small urn. */
function hip(S, P, k, z) {
  const pts = [P(-0.02, 0), P(0.04, -0.06), P(0.12, -0.085), P(0.2, -0.06), P(0.24, 0), P(0.2, 0.06), P(0.12, 0.085), P(0.04, 0.06)];
  S.put(`<path d="${S.smooth(pts)}" fill="${S.linear(P(0.12, -0.085), P(0.12, 0.085), [[0, 0.4 * k], [0.42, 0.62 * k], [1, 0.4 * k]])}"/>`, z);
}

/** A sepal: a narrow blade along a curve through four (u, v) points, high at its root, thin at its tip. */
function sepal(S, P, L, k, z, [a0, a1, a2, a3], wide = 1) {
  const sw = clamp(L * 0.095, 1.25, 2.2) * wide;
  const p0 = P(...a0);
  const p3 = P(...a3);
  const c = S.ctx.cubic(p0, P(...a1), P(...a2), p3);
  const outline = S.ctx.taper(c, (t) => sw * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.5)), 0.7) + 0.3, 14);
  S.points.push(p3);
  S.put(`<path d="${outline}" fill="${S.linear(p0, p3, [[0, 0.74 * k], [1, 0.5 * k]])}"/>`, z);
}

/**
 * A rosebud seen from the side, from `base` (where the stalk meets the hip) along `ang`, `L` long.
 * o: z, plump (width factor), height, flip (mirror the wrap of the petals)
 */
export function bud(S, base, ang, L, o = {}) {
  const { f } = S;
  const z = o.z ?? 8;
  const k = o.height ?? 1;
  const { P } = sideFrame(base, ang, L, o.flip ? -1 : 1);
  const Wb = 0.19 * (o.plump ?? 1);
  const tm = 0.38;
  const K = 1.8;
  const shape = (s) => Math.pow(s / tm, tm * K) * Math.pow((1 - s) / (1 - tm), (1 - tm) * K);
  const u0 = 0.18;
  const body = [P(u0, 0)];
  for (let i = 1; i < 10; i++) body.push(P(u0 + (1 - u0) * (i / 10), -Wb * shape(i / 10)));
  body.push(P(1, 0));
  for (let i = 9; i > 0; i--) body.push(P(u0 + (1 - u0) * (i / 10), Wb * shape(i / 10)));
  S.points.push(...body);
  const dBody = S.line(body);

  hip(S, P, k, z);
  // two sepals stand off either side with free tips; on the Damask rose they are long, and
  // reach to the tip of the bud or past it
  if (o.sepals === 'short') {
    sepal(S, P, L, k, z, [[0.16, -0.06], [0.34, -0.27], [0.56, -0.29], [0.84, -0.36]]);
    sepal(S, P, L, k, z, [[0.16, 0.06], [0.32, 0.26], [0.5, 0.28], [0.74, 0.34]], 0.92);
  } else {
    sepal(S, P, L, k, z, [[0.16, -0.06], [0.36, -0.27], [0.68, -0.21], [1.02, -0.3]]);
    sepal(S, P, L, k, z, [[0.16, 0.06], [0.34, 0.26], [0.6, 0.21], [0.9, 0.31]], 0.92);
  }

  // the furled petals: a rounded body, and the lip of the outermost petal winding down it
  let g = `<g clip-path="${S.clip(dBody)}"><path d="${dBody}" fill="${S.linear(P(0.6, -Wb), P(0.6, Wb), [[0, 0.4 * k], [0.45, 0.64 * k], [1, 0.42 * k]])}"/>`;
  if (L >= 12) {
    const lip = S.smooth([P(1.0, 0.03), P(0.82, -0.05), P(0.62, -0.03), P(0.44, 0.05), P(0.28, 0.17)], false);
    g += `<path d="${lip}" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="${f(clamp(L * 0.07, 0.9, 1.3))}" stroke-linecap="round"/>`;
  }
  // its edge turned up a little, so the whole outline reads
  g += `<path d="${dBody}" fill="none" stroke="${S.grey(0.74 * k)}" stroke-width="${f(clamp(L * 0.11, 1.4, 1.9))}" stroke-linejoin="round"/>`;
  g += `</g>`;
  S.put(g, z);
  // and one sepal laid up the front
  sepal(S, P, L, k, z, [[0.14, 0.0], [0.3, 0.04], [0.46, 0.02], [0.66, -0.04]], 0.85);
  return { tip: P(1, 0) };
}

/** A hollow petal seen from inside: a rounded lobe whose edge stands up round a sunk floor. */
function hollow(S, c, rx, ry, rot, o) {
  const { f, grey } = S;
  const pts = [];
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * TAU;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    pts.push([c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  S.points.push(...pts);
  const d = S.smooth(pts);
  S.put(
    `<g clip-path="${S.clip(d)}"><path d="${d}" fill="${grey(o.floor)}"/>` +
      `<path d="${d}" fill="none" stroke="${grey(o.lip)}" stroke-width="${f(o.reach * 2)}" filter="${S.blur(o.soft)}"/>` +
      `<path d="${d}" fill="none" stroke="${grey(o.lip + 0.06)}" stroke-width="${f(o.rim * 2)}"/></g>`,
    o.z,
  );
}

/**
 * A half-open rose seen from the side: a goblet of two outer petals with rolled, flaring lips,
 * the inner petals standing over it like a crown, sepals turned out beneath.
 * From `base` (top of the stalk) along `ang`, `L` long.  o: z, height, flip (mirror)
 */
export function cup(S, base, ang, L, o = {}) {
  const { f, grey } = S;
  const z = o.z ?? 9;
  const k = o.height ?? 1;
  const { P, Q } = sideFrame(base, ang, L, o.flip ? -1 : 1);
  const line = clamp(L * 0.05, 0.85, 1.25);
  const reach = clamp(L * 0.06, 0.8, 1.5);
  const soft = clamp(L * 0.045, 0.6, 1.1);

  hip(S, P, k, z);
  // sepals turned out and back, as they are once the flower opens
  sepal(S, P, L, k, z, [[0.15, -0.05], [0.2, -0.26], [0.17, -0.4], [0.06, -0.5]]);
  sepal(S, P, L, k, z, [[0.15, 0.05], [0.2, 0.25], [0.18, 0.38], [0.09, 0.47]], 0.92);

  // the crown: three inner petals seen from inside, the middle one tallest
  const turn = ang + Math.PI / 2;
  hollow(S, P(0.7, 0.2), L * 0.17, L * 0.15, turn, { floor: 0.3 * k, lip: 0.5 * k, reach, soft, rim: line * 0.8, z });
  hollow(S, P(0.72, -0.2), L * 0.17, L * 0.16, turn, { floor: 0.32 * k, lip: 0.54 * k, reach, soft, rim: line * 0.8, z });
  hollow(S, P(0.82, 0.0), L * 0.19, L * 0.19, turn, { floor: 0.36 * k, lip: 0.6 * k, reach, soft, rim: line * 0.8, z });
  hollow(S, P(0.74, 0.02), L * 0.1, L * 0.1, turn, { floor: 0.46 * k, lip: 0.7 * k, reach: reach * 0.6, soft: soft * 0.7, rim: line * 0.7, z });

  // the goblet: two petals seen from outside, swelling toward us, their lips flaring and rolled
  const bowl = Q([
    [0.15, 0], [0.22, -0.15], [0.36, -0.27], [0.5, -0.29], [0.6, -0.33], [0.67, -0.41],
    [0.62, -0.24], [0.58, -0.08], [0.57, 0.06], [0.6, 0.22],
    [0.66, 0.4], [0.59, 0.32], [0.5, 0.28], [0.36, 0.26], [0.22, 0.15],
  ]);
  S.points.push(...bowl);
  const dBowl = S.smooth(bowl);
  const lipRun = Q([[0.69, -0.44], [0.62, -0.24], [0.58, -0.08], [0.57, 0.06], [0.6, 0.22], [0.68, 0.43]]);
  const under = Q([[0.62, -0.42], [0.55, -0.24], [0.51, -0.08], [0.5, 0.06], [0.53, 0.22], [0.61, 0.41]]);
  const part = S.smooth(Q([[0.59, 0.05], [0.47, 0.1], [0.34, 0.07], [0.2, -0.02]]), false);
  S.put(
    `<g clip-path="${S.clip(dBowl)}"><path d="${dBowl}" fill="${S.radial(P(0.38, -0.04), L * 0.4, [[0, 0.64 * k], [0.55, 0.56 * k], [1, 0.36 * k]])}"/>` +
      `<path d="${S.smooth(under, false)}" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="${f(line * 1.5)}" filter="${S.blur(0.6)}"/>` +
      `<path d="${part}" fill="none" stroke="#000" stroke-opacity="0.42" stroke-width="${f(line)}" stroke-linecap="round"/>` +
      `<path d="${S.smooth(lipRun, false)}" fill="none" stroke="${grey(0.8 * k)}" stroke-width="${f(line * 2.2)}"/></g>`,
    z,
  );
  // a sepal laid up the front of the goblet
  sepal(S, P, L, k, z, [[0.1, 0.0], [0.24, 0.03], [0.36, 0.0], [0.46, -0.05]], 0.85);
  return { tip: P(1, 0) };
}

/**
 * A stem through points (a smooth curve), tapering from width w0 to w1.
 * Returns the curve, so leaves and flowers can be hung on it with at(t) / heading(t).
 * o: h (height), z, steps, foot (0..1: the first part is drawn in to a fine end, for a stem
 *    that stands free on the paper)
 */
export function stem(S, pts, w0, w1, o = {}) {
  const c = spline(pts);
  const steps = o.steps ?? Math.max(16, pts.length * 10);
  const foot = o.foot ?? 0;
  const width = (t) => lerp(w0, w1, t) * (foot && t < foot ? 0.35 + 0.65 * Math.sin((t / foot) * (Math.PI / 2)) : 1);
  S.put(`<path d="${S.ctx.taper(c, width, steps)}" fill="${S.grey(o.h ?? 0.6)}"/>`, o.z ?? 2);
  for (let i = 0; i <= 8; i++) S.points.push(c.at(i / 8));
  return c;
}

/** For a stem that climbs the page: where it crosses a height y. Gives at(y), heading(y), t(y). */
export function climb(curve, samples = 800) {
  const t = (y) => {
    let best = 0;
    let gap = Infinity;
    for (let i = 0; i <= samples; i++) {
      const g = Math.abs(curve.at(i / samples)[1] - y);
      if (g < gap) {
        gap = g;
        best = i / samples;
      }
    }
    return best;
  };
  return { t, at: (y) => curve.at(t(y)), heading: (y) => curve.heading(t(y)) };
}

/**
 * A light spray: a thin stem through points with small leaflets, drawn in line, set alternately
 * along it and one at its tip.
 * o: leaves (how many), size (leaflet length at the foot), from, to (where they sit, 0..1),
 *    spread (degrees), first (+1 / -1: the side of the first leaflet), w0, w1, z
 */
export function spray(S, pts, o = {}) {
  const c = stem(S, pts, o.w0 ?? 1.2, o.w1 ?? 0.8, { z: o.z ?? 2 });
  const n = o.leaves ?? 5;
  const size = o.size ?? 11;
  for (let i = 0; i < n; i++) {
    const t = lerp(o.from ?? 0.2, o.to ?? 0.88, n > 1 ? i / (n - 1) : 0.5);
    const side = (i % 2 ? 1 : -1) * (o.first ?? 1);
    leaflet(S, c.at(t), c.heading(t) + side * deg(o.spread ?? 40), size * (1 - 0.28 * t), {
      bend: -side * 0.06,
      plain: true,
      z: o.z ?? 4,
    });
  }
  leaflet(S, c.at(1), c.heading(1), size * 0.78, { plain: true, z: o.z ?? 4 });
  return c;
}

/**
 * A hair-fine stalk through points carrying seed-pearl buds on short side stalks and one at its tip.
 * o: beads (how many along the sides), r (bead radius), from (0..1), stalk (side stalk length), first (+1 / -1)
 */
export function pearls(S, pts, o = {}) {
  const c = stem(S, pts, o.w0 ?? 1.0, o.w1 ?? 0.8, { z: o.z ?? 2 });
  const n = o.beads ?? 2;
  const r = o.r ?? 1.5;
  for (let i = 0; i < n; i++) {
    const t = lerp(o.from ?? 0.4, 0.82, n > 1 ? i / (n - 1) : 0.5);
    const side = (i % 2 ? 1 : -1) * (o.first ?? 1);
    const p = c.at(t);
    const q = polar(p, c.heading(t) + side * deg(52), o.stalk ?? 4.5);
    S.put(`<path d="M${S.f(p[0])} ${S.f(p[1])}L${S.f(q[0])} ${S.f(q[1])}" fill="none" stroke="${S.grey(0.6)}" stroke-width="0.85"/>`, o.z ?? 2);
    bead(S, q, r * 0.9);
  }
  bead(S, c.at(1), r);
  return c;
}

/** A tiny round bud, the size of a seed pearl. */
export function bead(S, c, r, o = {}) {
  const h = o.h ?? 0.95;
  S.points.push([c[0] - r, c[1]], [c[0] + r, c[1]], [c[0], c[1] - r], [c[0], c[1] + r]);
  S.put(
    `<circle cx="${S.f(c[0])}" cy="${S.f(c[1])}" r="${S.f(r)}" fill="${S.radial(c, r, [[0, h], [0.6, h * 0.86], [1, h * 0.55]])}"/>`,
    o.z ?? 8,
  );
}

// ---------------------------------------------------------------------------------------------
// Working aids. They do nothing unless the environment variable FLORA_GUIDES is set, so the
// finished art never carries them:  $env:FLORA_GUIDES = 1; node scripts/generate-relief.mjs ...

const working = () => Boolean(globalThis.process?.env?.FLORA_GUIDES);

/** Thin raised lines along the limits a composition must keep to. */
export function guides(S, lines) {
  if (!working()) return;
  for (const pts of lines) {
    S.put(`<path d="${S.line(pts, false)}" fill="none" stroke="${S.grey(0.4)}" stroke-width="0.8"/>`, 99);
  }
}

/** Reports how many drawn outline points fall outside the area a piece is allowed, as judged by `inside([x, y])`. */
export function check(S, label, inside) {
  if (!working()) return;
  const out = S.points.filter((p) => !inside(p));
  const worst = out.slice(0, 6).map((p) => `(${S.f(p[0])}, ${S.f(p[1])})`).join(' ');
  console.log(`  ${label}: ${out.length} of ${S.points.length} points outside${out.length ? `, e.g. ${worst}` : ''}`);
}
