// The medallion for the "location" section: two date palms on the bank of the Tigris with the
// sun going down between them, inside a fine ring and a ring of beads.
//
// One thing shapes the whole drawing. The light stands at the top left, so a ridge that runs
// from the top left to the bottom right has nothing to catch it and all but vanishes. Wherever a
// pattern would need that direction it is drawn another way:
//  - the criss-cross of a date palm's trunk is laid as courses of small shields, like brickwork,
//    whose edges run level and upright (a lattice of diagonals shows as a rope of slanting
//    stripes: only one of its two directions is lit);
//  - the sun's rays alternate with pearls, which the light finds from any side, so the crown of
//    the sun stays whole where its rays point at the light and fade.

const NAME = 'medallion';

/** Distance along a curve, so things can be set at measured intervals. */
function measure(curve, n = 200) {
  const table = [0];
  let prev = curve.at(0);
  for (let i = 1; i <= n; i++) {
    const p = curve.at(i / n);
    table.push(table[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
    prev = p;
  }
  const length = table[n];
  const tAt = (s) => {
    if (s <= 0) return 0;
    if (s >= length) return 1;
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid] < s) lo = mid;
      else hi = mid;
    }
    return (lo + (s - table[lo]) / (table[hi] - table[lo])) / n;
  };
  return { length, tAt };
}

// Everything that can be tuned, so that trial sheets can vary one thing at a time.
export const DEFAULTS = {
  material: 'paper',
  // Three picture pixels to the design pixel. The medallion is shown small (about 150 px) and
  // is all fine detail; on phones with three device pixels to the CSS pixel a 2x picture would
  // be enlarged and its leaflets and beads would soften.
  scale: 3,
  beads: 64,
  // The brief asks for a ring of about 78. At 78 the shadows the lowest beads cast reach the
  // edge of the picture and leave it short of flat; at 77.2 the edge is clean.
  beadRing: 77.2,
  bead: 2.2,
  ring: 71.4,
  ringWide: 1.5,
  ground: 122.5, // the level of the bank, before the scene is set into the ring
  zoom: 1.04, // the scene is enlarged by this about the point below
  zoomAbout: [86, 86],
  relief: 0.9, // scales every height inside the ring: the rim stands highest, as on a medal
  favour: 1.3, // how much deeper the fronds that face the light are cut (0 for not at all)
  // heights
  h: {
    bead: 1,
    ring: 0.95,
    sun: [0.5, 0.4, 0.26], // crown, shoulder, limb
    ray: 0.6,
    pearl: 0.84,
    bank: 0.62,
    ripple: 0.55,
    trunk: 0.42,
    shield: [0.82, 0.72], // down the middle of the trunk, and at its edges
    web: [0.16, 0.22], // the body of a frond in the back rank, in the front rank
    leaflet: [0.6, 0.68],
    rib: [0.95, 1],
    heart: 0.8,
    stalk: 0.85,
    date: 1,
  },
  // places counted from the sun's centre: where rays begin and end, where the pearls sit
  sun: { x: 88.5, r: 10.6, places: 11, from: 15, to: 24, pearl: 17.4 },
  frond: { leaflet: 5, pitch: 4, wide: 1.6, open: 50, close: 27, web: 0.65, moat: 2.4 },
  trunk: { step: 3.8, wide: 0.7, tall: 0.66 },
  palms: [
    {
      foot: [59.5, 2.5], // x, and depth below the level of the bank
      top: [63.5, 57.5],
      lean: [3.4, 1.4],
      girth: 7,
      reach: 1,
      // [degrees from upright, length, how far the tip bends down, where the leaflets begin]
      fronds: [
        [-98, 24, 50, 0.5],
        [97, 24, 52, 0.5],
        [-74, 26.5, 44],
        [73, 25.5, 44],
        [-50, 26, 30],
        [48, 27.5, 30],
        [-26, 25, 16],
        [23, 27, 16],
        [-2, 25, 5],
      ],
      // [side, how far out, how far down]
      dates: [
        [-1, 9.4, 7],
        [1, 9.6, 8],
      ],
    },
    {
      foot: [118.5, 2.7],
      top: [115, 72.5],
      lean: [-3, -1.2],
      girth: 6.8,
      reach: 0.84,
      fronds: [
        [-97, 24, 52, 0.5],
        [98, 24, 50, 0.5],
        [-73, 26.5, 44],
        [74, 27, 44],
        [-48, 26, 30],
        [50, 27.5, 30],
        [-23, 27, 16],
        [26, 27, 16],
        [2, 25, 5],
      ],
      dates: [
        [-1, 9.8, 7.5],
        [1, 9.6, 6.8],
      ],
    },
  ],
};

export function make(name = NAME, options = {}) {
  const o = { ...DEFAULTS, ...options, h: { ...DEFAULTS.h, ...options.h } };
  for (const k of ['sun', 'frond', 'trunk']) o[k] = { ...DEFAULTS[k], ...options[k] };
  return {
    name,
    width: 170,
    height: 170,
    material: o.material,
    scale: o.scale,
    draw({ W, f, grey, rad, cubic, taper, almond }) {
      const C = W / 2;
      const H = o.h;
      let defs = '';
      const dir = (a) => [Math.cos(a), Math.sin(a)];
      const poly = (pts) => `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z`;
      // every height inside the ring passes through here
      const hgt = (v) => grey(v * o.relief);

      // ------------------------------------------------------------------ the rim
      let rim = '';
      defs +=
        `<radialGradient id="${name}-bead"><stop offset="0" stop-color="${grey(H.bead)}"/>` +
        `<stop offset="0.5" stop-color="${grey(H.bead * 0.96)}"/><stop offset="1" stop-color="${grey(H.bead * 0.62)}"/></radialGradient>`;
      for (let i = 0; i < o.beads; i++) {
        const a = (i / o.beads) * Math.PI * 2 - Math.PI / 2;
        rim += `<circle cx="${f(C + Math.cos(a) * o.beadRing)}" cy="${f(C + Math.sin(a) * o.beadRing)}" r="${o.bead}" fill="url(#${name}-bead)"/>`;
      }
      rim += `<circle cx="${C}" cy="${C}" r="${o.ring}" fill="none" stroke="${grey(H.ring)}" stroke-width="${o.ringWide}"/>`;

      // ------------------------------------------------------------------ the scene
      let s = '';
      const GROUND = o.ground;
      const sun = [o.sun.x, GROUND + 0.6];

      // the sun: a low dome half sunk behind the bank, crowned with rays and pearls in turn
      defs +=
        `<radialGradient id="${name}-sun" gradientUnits="userSpaceOnUse" cx="${sun[0]}" cy="${sun[1]}" r="${o.sun.r}">` +
        `<stop offset="0" stop-color="${hgt(H.sun[0])}"/><stop offset="0.7" stop-color="${hgt(H.sun[1])}"/><stop offset="1" stop-color="${hgt(H.sun[2])}"/></radialGradient>` +
        `<clipPath id="${name}-sky"><rect x="0" y="0" width="${W}" height="${GROUND + 0.6}"/></clipPath>`;
      s += `<circle cx="${sun[0]}" cy="${sun[1]}" r="${o.sun.r}" fill="url(#${name}-sun)" clip-path="url(#${name}-sky)"/>`;
      for (let i = 0; i < o.sun.places; i++) {
        const [c, n] = dir(rad(190 + (i * 160) / (o.sun.places - 1)));
        const at = (r) => [sun[0] + c * r, sun[1] + n * r];
        if (i % 2) {
          const { from, to } = o.sun;
          const ray = cubic(at(from), at(from + 2), at(to - 2), at(to));
          s += `<path d="${taper(ray, (t) => 1.8 - 1.0 * t, 6)}" fill="${hgt(H.ray)}"/>`;
        } else {
          const [x, y] = at(o.sun.pearl);
          s += `<circle cx="${f(x)}" cy="${f(y)}" r="1.3" fill="${hgt(H.pearl)}"/>`;
        }
      }

      // the bank: one long low line that stops a little short of the ring at either end, and the
      // river under it
      const bank = cubic([37.5, GROUND + 2.8], [63, GROUND - 0.6], [108, GROUND + 0.3], [132.5, GROUND + 2.6]);
      s += `<path d="${taper(bank, (t) => 0.5 + 2.2 * Math.sin(Math.PI * t) ** 0.5, 60)}" fill="${hgt(H.bank)}"/>`;
      for (const [y, x0, x1] of [
        [GROUND + 8.4, 47, 79],
        [GROUND + 8.8, 92, 124],
        [GROUND + 14, 59, 96],
        [GROUND + 14.4, 104, 117],
        [GROUND + 19.6, 73, 101],
      ]) {
        const w = x1 - x0;
        const ripple = cubic([x0, y], [x0 + w * 0.3, y - 1.4], [x0 + w * 0.7, y + 1.4], [x1, y]);
        s += `<path d="${taper(ripple, (t) => 0.4 + 1.1 * Math.sin(Math.PI * t) ** 0.6, 30)}" fill="${hgt(H.ripple)}"/>`;
      }

      // ------------------------------------------------------------------ a palm
      const palm = ({ foot: footAt, top, lean, girth, fronds, reach, dates }) => {
        let p = '';
        const foot = [footAt[0], GROUND + footAt[1]];

        // -- the trunk: a ribbon, a little wider at the root and under the crown
        const h = foot[1] - top[1];
        const axis = cubic(foot, [foot[0] + lean[0], foot[1] - h * 0.36], [top[0] + lean[1], top[1] + h * 0.3], top);
        const run = measure(axis);
        const half = (t) => (girth / 2) * (1 + 0.34 * Math.exp(-t / 0.06) + 0.14 * Math.exp(-(1 - t) / 0.07));
        p += `<path d="${taper(axis, (t) => 2 * half(t), 50)}" fill="${hgt(H.trunk)}"/>`;
        // the old leaf bases: one shield in the middle with a half at each edge, then two side
        // by side, course upon course; the eye joins them into the criss-cross
        const step = o.trunk.step;
        const rows = Math.floor((run.length - 2.4) / step);
        for (let k = 0; k <= rows; k++) {
          const t = run.tAt(2 + k * step);
          const [x, y] = axis.at(t);
          const [tx, ty] = dir(axis.heading(t));
          const [nx, ny] = [-ty, tx];
          const hw = half(t);
          const wide = hw * o.trunk.wide;
          const tall = step * o.trunk.tall;
          for (const off of k % 2 ? [-0.52, 0.52] : [-1, 0, 1]) {
            const cx = x + nx * (hw - 0.3) * off;
            const cy = y + ny * (hw - 0.3) * off;
            // wider at the foot than at the head, as a cut leaf base is
            p += `<path d="${poly([
              [cx - nx * wide * 0.5 - tx * tall * 0.5, cy - ny * wide * 0.5 - ty * tall * 0.5],
              [cx + nx * wide * 0.5 - tx * tall * 0.5, cy + ny * wide * 0.5 - ty * tall * 0.5],
              [cx + nx * wide * 0.32 + tx * tall * 0.5, cy + ny * wide * 0.32 + ty * tall * 0.5],
              [cx - nx * wide * 0.32 + tx * tall * 0.5, cy - ny * wide * 0.32 + ty * tall * 0.5],
            ])}" fill="${hgt(Math.abs(off) === 1 ? H.shield[1] : H.shield[0])}"/>`;
          }
        }

        // -- the crown: fronds in two ranks, so that neighbours part cleanly
        const [ox, oy] = [top[0], top[1] - 2];
        const F = o.frond;
        const rank = ['', ''];
        fronds.forEach(([a, len, bend, t0 = 0.24], i) => {
          const z = i % 2;
          // the rib leaves the heart along h0 and arrives, bent by its own weight, along h1
          const h0 = rad(a - 90);
          const sign = a >= 0 ? 1 : -1;
          const h1 = h0 + sign * rad(bend);
          const hm = h0 + sign * rad(bend * 0.42);
          const L = len * reach;
          const p0 = [ox + Math.cos(h0) * 1.5, oy + Math.sin(h0) * 1.5];
          const p3 = [p0[0] + Math.cos(hm) * L * 0.95, p0[1] + Math.sin(hm) * L * 0.95];
          const rib = cubic(p0, [p0[0] + Math.cos(h0) * L * 0.42, p0[1] + Math.sin(h0) * L * 0.42], [p3[0] - Math.cos(h1) * L * 0.3, p3[1] - Math.sin(h1) * L * 0.3], p3);
          const along = measure(rib, 120);
          // leaflets: longest before the middle, closing towards the rib as they near the tip
          const long = F.leaflet * reach;
          const lenAt = (u) => long * Math.sin(Math.PI * (0.16 + 0.84 * u) ** 0.85) ** 0.7;
          const angAt = (u) => rad(F.open - (F.open - F.close) * u);
          const body = (t) => (t < t0 ? 0 : 2 * 0.8 * lenAt((t - t0) / (1 - t0)) * Math.sin(angAt((t - t0) / (1 - t0))));
          // A frond that points up and to the left points at the light: its rib throws no shade
          // and it would fade beside its neighbours. Its leaflets and web are cut that much
          // deeper, as an engraver would cut them.
          const shy = Math.max(0, 1 - Math.abs(a + 45) / 32) * o.favour;
          let g = '';
          // a moat, so that this frond stands clear of whatever lies under it
          g += `<path d="${taper(rib, (t) => body(t) + F.moat, 40)}" fill="${grey(0.04)}"/>`;
          // a faint web that ties the leaflets into one plume
          g += `<path d="${taper(rib, (t) => body(t) * F.web, 40)}" fill="${hgt(H.web[z] * (1 + 0.9 * shy))}"/>`;
          for (const side of [-1, 1]) {
            for (let d = t0 * along.length + (side > 0 ? F.pitch / 2 : 0); d < along.length - 2; d += F.pitch) {
              const t = along.tAt(d);
              const u = (t - t0) / (1 - t0);
              const [x, y] = rib.at(t);
              let a1 = rib.heading(t) + side * angAt(u);
              // leaflets hang: the ones that point downwards a good deal, the others hardly
              const down = Math.sin(a1) > 0;
              let turn = Math.PI / 2 - a1;
              while (turn > Math.PI) turn -= Math.PI * 2;
              while (turn < -Math.PI) turn += Math.PI * 2;
              a1 += turn * (down ? 0.24 : 0.04);
              const l = lenAt(u) * (down ? 1.1 : 0.95);
              if (l < 1.8) continue;
              g += `<path d="${almond(x, y, a1, l, F.wide, 0.32)}" fill="${hgt(H.leaflet[z] * (1 + 0.4 * shy))}"/>`;
            }
          }
          g += `<path d="${taper(rib, (t) => 1.8 - 1.0 * t, 40)}" fill="${hgt(H.rib[z])}"/>`;
          rank[z] += g;
        });
        p += rank[0] + rank[1];

        // -- the heart of the crown, and a cluster of dates hung under it on either side
        p += `<ellipse cx="${f(ox)}" cy="${f(oy + 0.6)}" rx="2.6" ry="2.4" fill="${hgt(H.heart)}"/>`;
        for (const [sx, out, drop] of dates) {
          const x0 = ox + sx * 1.2;
          const y0 = oy + 2.4;
          const x1 = ox + sx * out * reach ** 0.5;
          const y1 = oy + drop;
          const stalk = cubic([x0, y0], [x0 + sx * out * 0.6, y0 - 1], [x1, y1 - 5], [x1, y1]);
          p += `<path d="${stalk.d}" stroke="${hgt(H.stalk)}" stroke-width="1.3" fill="none"/>`;
          for (const [dx, dy] of [
            [0, 0.8],
            [-2.1, 4.2],
            [2.1, 4.2],
            [0, 7.7],
          ]) {
            p += `<circle cx="${f(x1 + dx)}" cy="${f(y1 + dy)}" r="1.5" fill="${hgt(H.date)}"/>`;
          }
        }
        return p;
      };

      for (const one of o.palms) s += palm(one);

      // the scene is drawn at its own size and then set into the ring
      const [zx, zy] = o.zoomAbout;
      const place = o.zoom === 1 ? '' : ` transform="translate(${zx} ${zy}) scale(${o.zoom}) translate(${-zx} ${-zy})"`;
      return `<defs>${defs}</defs>${rim}<g${place}>${s}</g>`;
    },
  };
}

export default make();
