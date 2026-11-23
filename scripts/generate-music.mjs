// Composes and renders the invitation's background music: an original 32-bar waltz in D major
// for soft piano, a quiet pad and a touch of celesta. Everything is synthesised here, so there
// are no samples and nothing to license.
//
//   node scripts/generate-music.mjs        (needs ffmpeg on PATH for the MP3 encode)

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const OUT = 'public/audio/engagement-waltz.mp3';
const SR = 44100;
const BEAT = 60 / 72; // a quarter note at 72 bpm, three to the bar
const TAIL = 7; // seconds of ring-out, folded back onto the start so the loop has no seam

// One bar per row: pad chord | six left-hand eighth notes | melody as note:beats
const SCORE = [
  // A
  ['D3 A3 F#4', 'D2 A2 D3 F#3 D3 A2', 'F#5:2 A5:1'],
  ['C#3 A3 E4', 'C#3 E3 A3 C#4 A3 E3', 'E5:2 C#5:1'],
  ['B2 F#3 D4', 'B2 F#3 B3 D4 B3 F#3', 'D5:2 F#5:1'],
  ['A2 F#3 C#4', 'A2 F#3 A3 C#4 A3 F#3', 'C#5:3'],
  ['G2 D3 B3', 'G2 D3 G3 B3 G3 D3', 'B4:1 D5:1 G5:1'],
  ['F#2 D3 A3', 'F#2 D3 F#3 A3 F#3 D3', 'F#5:2 D5:1'],
  ['E3 B3 D4 G4', 'E2 B2 D3 G3 D3 B2', 'G5:2 E5:1'],
  ['A2 E3 G3', 'A2 E3 G3 A3 G3 E3', 'D5:2 C#5:1'],
  // A, lifted
  ['D3 A3 F#4', 'D2 A2 D3 F#3 D3 A2', 'F#5:2 A5:1'],
  ['C#3 A3 E4', 'C#3 E3 A3 C#4 A3 E3', 'E5:2 A5:1'],
  ['B2 F#3 D4', 'B2 F#3 B3 D4 B3 F#3', 'B5:2 A5:1'],
  ['A2 F#3 C#4', 'A2 F#3 A3 C#4 A3 F#3', 'F#5:3'],
  ['G2 D3 B3', 'G2 D3 G3 B3 G3 D3', 'G5:1 F#5:1 E5:1'],
  ['F#2 D3 A3', 'F#2 D3 F#3 A3 F#3 D3', 'D5:2 F#5:1'],
  ['E3 B3 G4', 'E2 B2 G3 B2 A2 G3', 'E5:2 C#5:1'],
  ['D3 A3 F#4', 'D2 A2 D3 F#3 A3 F#3', 'D5:3'],
  // B
  ['G2 D3 B3', 'G2 D3 G3 B3 G3 D3', 'D5:1 G5:1 B5:1'],
  ['G2 E3 A3 C#4', 'G2 E3 A3 C#4 A3 E3', 'A5:2 E5:1'],
  ['F#2 C#3 A3', 'F#2 C#3 F#3 A3 F#3 C#3', 'C#5:1 F#5:1 A5:1'],
  ['B2 F#3 D4', 'B2 F#3 B3 D4 B3 F#3', 'F#5:2 D5:1'],
  ['E3 B3 G4', 'E2 B2 E3 G3 E3 B2', 'B4:1 E5:1 G5:1'],
  ['A2 G3 C#4 E4', 'A2 E3 G3 C#4 G3 E3', 'G5:2 E5:1'],
  ['F#2 D3 A3', 'F#2 D3 F#3 A3 F#3 D3', 'F#5:2 A5:1'],
  ['A2 E3 C#4', 'A2 E3 A3 C#4 A3 E3', 'B5:1 A5:1 E5:1'],
  // A, closing
  ['D3 A3 F#4', 'D2 A2 D3 F#3 D3 A2', 'F#5:2 A5:1'],
  ['C#3 A3 E4', 'C#3 E3 A3 C#4 A3 E3', 'E5:2 C#5:1'],
  ['B2 F#3 D4', 'B2 F#3 B3 D4 B3 F#3', 'D5:2 F#5:1'],
  ['A2 F#3 B3 D4', 'A2 F#3 B3 D4 B3 F#3', 'F#5:1 B5:2'],
  ['G2 D3 B3', 'G2 D3 G3 B3 G3 D3', 'B5:1 A5:1 G5:1'],
  ['E3 B3 G4', 'E2 B2 G3 B2 A2 G3', 'G5:1 E5:1 C#5:1'],
  ['D3 A3 F#4', 'D2 A2 D3 F#3 A3 F#3', 'D5:3'],
  ['A2 E3 G3', 'A2 E3 G3 D4 C#4 G3', 'E5:3'], // turnaround: the last bar leans back into the first
];
// loudness of each bar: four phrases that swell and settle
const DYNAMICS = [
  0.78, 0.82, 0.86, 0.8, 0.84, 0.88, 0.84, 0.76, 0.84, 0.9, 0.96, 0.9, 0.9, 0.86, 0.8, 0.74,
  0.84, 0.9, 0.93, 0.9, 0.88, 0.93, 0.97, 0.9, 0.88, 0.9, 0.93, 1, 0.93, 0.85, 0.76, 0.66,
];
const STRETCH = SCORE.map((_, i) => (i === 30 ? 1.05 : i === 31 ? 1.16 : 1)); // the last two bars slow down
const CELESTA_BARS = [16, 30]; // the melody is doubled an octave up from the B section on

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (name) => {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  assert(m, `bad note name: ${name}`);
  return 12 * (Number(m[3]) + 1) + SEMITONE[m[1]] + (m[2] ? 1 : 0);
};
const hertz = (note) => 440 * 2 ** ((note - 69) / 12);

// self-check: every bar is complete and stays in D major
const D_MAJOR = new Set([2, 4, 6, 7, 9, 11, 1]);
assert.equal(SCORE.length, 32);
assert.equal(DYNAMICS.length, 32);
for (const [pad, left, melody] of SCORE) {
  assert.equal(left.split(' ').length, 6, `left hand needs six notes: ${left}`);
  assert.equal(melody.split(' ').reduce((sum, n) => sum + Number(n.split(':')[1]), 0), 3, `melody must fill the bar: ${melody}`);
  for (const name of [...pad.split(' '), ...left.split(' '), ...melody.split(' ').map((n) => n.split(':')[0])]) {
    assert(D_MAJOR.has(midi(name) % 12), `${name} is outside D major`);
  }
}

const barStart = [0];
for (const stretch of STRETCH) barStart.push(barStart.at(-1) + 3 * BEAT * stretch);
const LOOP = Math.round(barStart.at(-1) * SR);
const N = LOOP + TAIL * SR;
const L = new Float64Array(N);
const R = new Float64Array(N);

let seed = 20261126;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

/** Adds one decaying sine partial. Uses a two-multiply resonator instead of Math.sin per sample. */
function partial(start, length, freq, amp, pan, envelope) {
  const w = (2 * Math.PI * freq) / SR;
  const k = 2 * Math.cos(w);
  let y1 = Math.sin(-w);
  let y2 = Math.sin(-2 * w);
  const gl = Math.cos(((pan + 1) * Math.PI) / 4) * amp;
  const gr = Math.sin(((pan + 1) * Math.PI) / 4) * amp;
  const end = Math.min(N - start, length);
  for (let i = 0; i < end; i++) {
    const y = k * y1 - y2;
    y2 = y1;
    y1 = y;
    const s = y * envelope(i);
    L[start + i] += s * gl;
    R[start + i] += s * gr;
  }
}

/** Soft felt piano: harmonics that die away faster the higher they are, two strings a hair apart. */
function piano(time, note, hold, velocity) {
  const f = hertz(note);
  const start = Math.max(0, Math.round(time * SR));
  const held = Math.round(hold * SR);
  const attack = 0.009 * SR;
  const release = 0.24 * SR;
  const length = held + Math.round(release * 7);
  const sustain = Math.min(5.5, Math.max(0.8, 3.4 * (261.6 / f) ** 0.6)); // low notes ring longer
  const dark = 1.35 + 1.1 * (1 - velocity); // a softer touch has fewer overtones
  const pan = Math.max(-0.45, Math.min(0.45, (note - 62) / 40));
  const count = Math.max(2, Math.min(12, Math.floor(6500 / f)));
  for (let h = 1; h <= count; h++) {
    const fh = f * h * Math.sqrt(1 + 0.00035 * h * h); // stiff strings run slightly sharp
    const amp = (velocity * h ** -dark) / (1 + (fh / 3800) ** 2);
    const tau = (sustain / (1 + 0.32 * (h - 1))) * SR;
    for (const cents of h <= 5 ? [-0.6, 0.6] : [0]) {
      const share = cents ? 0.5 : 1;
      partial(start, length, fh * 2 ** (cents / 1200), amp * share, pan, (i) => {
        const body = 0.78 * Math.exp(-i / tau) + 0.22 * Math.exp(-i / (tau * 3.5));
        const rise = i < attack ? 0.5 - 0.5 * Math.cos((Math.PI * i) / attack) : 1;
        const damp = i > held ? Math.exp(-(i - held) / release) : 1;
        return body * rise * damp;
      });
    }
  }
}

/** Warm pad under each chord: slow swell in, slow fade out, slightly detuned left and right. */
function pad(time, note, duration, level) {
  const f = hertz(note);
  const start = Math.round(time * SR);
  const swell = 1.1 * SR;
  const fade = 1.7 * SR;
  const held = Math.round(duration * SR);
  for (const [cents, pan] of [
    [-5, -0.7],
    [4, 0.7],
  ]) {
    for (let h = 1; h <= 4; h++) {
      partial(start, held + fade, f * h * 2 ** (cents / 1200), (level * h ** -2.4) / 2, pan, (i) => {
        if (i < swell) return Math.sin((Math.PI / 2) * (i / swell)) ** 2;
        if (i > held) return Math.cos((Math.PI / 2) * ((i - held) / fade)) ** 2;
        return 1;
      });
    }
  }
}

/** Celesta: a small bell that doubles the melody an octave higher. */
function celesta(time, note, velocity) {
  const f = hertz(note);
  const start = Math.round(time * SR);
  for (const [ratio, amp, seconds] of [
    [1, 1, 1.3],
    [2.01, 0.28, 0.7],
    [3.9, 0.1, 0.35],
  ]) {
    partial(start, 4 * SR, f * ratio, velocity * amp, 0.25, (i) => Math.min(1, i / 90) * Math.exp(-i / (seconds * SR)));
  }
}

// ---- perform the score ----
SCORE.forEach(([padNotes, left, melody], bar) => {
  const beat = BEAT * STRETCH[bar];
  const t0 = barStart[bar];
  const barEnd = barStart[bar + 1];
  const dyn = DYNAMICS[bar];
  const human = () => (random() - 0.5) * 0.012; // nobody plays exactly on the grid

  for (const name of padNotes.split(' ')) pad(t0, midi(name), barEnd - t0, 0.055);

  // the sustain pedal is changed once a bar, so every note rings to the bar line
  left.split(' ').forEach((name, i) => {
    const t = t0 + (i * beat) / 2 + human();
    piano(t, midi(name), barEnd - t, [0.4, 0.29, 0.31, 0.36, 0.3, 0.28][i] * dyn * (0.94 + random() * 0.12));
  });

  let at = 0;
  melody.split(' ').forEach((token, i) => {
    const [name, beats] = token.split(':');
    const t = t0 + at * beat + 0.012 + human();
    const velocity = (i === 0 ? 0.82 : 0.76) * dyn * (0.95 + random() * 0.1);
    piano(t, midi(name), barEnd - t, velocity);
    if (bar >= CELESTA_BARS[0] && bar < CELESTA_BARS[1]) celesta(t, midi(name) + 12, 0.1 * dyn);
    at += Number(beats);
  });
});

// ---- room: a Freeverb-style hall (eight damped combs into four all-passes per side) ----
function hall(input, offset) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((n) => ({ buf: new Float64Array(n + offset), i: 0, low: 0 }));
  const allpasses = [556, 441, 341, 225].map((n) => ({ buf: new Float64Array(n + offset), i: 0 }));
  const out = new Float64Array(N);
  const feedback = 0.9;
  const damping = 0.28;
  for (let n = 0; n < N; n++) {
    let y = 0;
    for (const c of combs) {
      const delayed = c.buf[c.i];
      c.low = delayed * (1 - damping) + c.low * damping;
      c.buf[c.i] = input[n] + c.low * feedback;
      if (++c.i === c.buf.length) c.i = 0;
      y += delayed;
    }
    for (const a of allpasses) {
      const delayed = a.buf[a.i];
      a.buf[a.i] = y + delayed * 0.5;
      if (++a.i === a.buf.length) a.i = 0;
      y = delayed - y;
    }
    out[n] = y;
  }
  return out;
}

/** One-pole high-pass, in place. */
function highpass(samples, cutoff) {
  const a = 1 / (1 + (2 * Math.PI * cutoff) / SR);
  let previousIn = 0;
  let previousOut = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    previousOut = a * (previousOut + x - previousIn);
    previousIn = x;
    samples[i] = previousOut;
  }
  return samples;
}

const rms = (a) => Math.sqrt(a.reduce((sum, v) => sum + v * v, 0) / a.length);
// only the upper register is sent to the hall: reverb on bass notes turns to mud
const send = highpass(L.map((v, i) => (v + R[i]) / 2), 300);
const wetL = hall(send, 0);
const wetR = hall(send, 23);
const wet = (0.36 * rms(L)) / rms(wetL); // the hall sits well behind the piano
for (let i = 0; i < N; i++) {
  L[i] += wetL[i] * wet;
  R[i] += wetR[i] * wet;
}
// clear out rumble no phone or earbud can play
for (const channel of [L, R]) highpass(highpass(channel, 45), 45);

// fold the ring-out back onto the opening bars, then trim to exactly one loop
for (let i = LOOP; i < N; i++) {
  L[i - LOOP] += L[i];
  R[i - LOOP] += R[i];
}
let peak = 0;
for (let i = 0; i < LOOP; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
assert(Number.isFinite(peak) && peak > 0, 'render produced no sound');
// kept quiet on purpose: iPhones ignore the page's volume setting, so the file itself must sit in the background
const PEAK = 0.56;
const gain = PEAK / peak;

// ---- write a WAV, let ffmpeg make the MP3 ----
const pcm = Buffer.alloc(44 + LOOP * 4);
pcm.write('RIFF', 0);
pcm.writeUInt32LE(36 + LOOP * 4, 4);
pcm.write('WAVEfmt ', 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20); // PCM
pcm.writeUInt16LE(2, 22); // stereo
pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 4, 28);
pcm.writeUInt16LE(4, 32);
pcm.writeUInt16LE(16, 34);
pcm.write('data', 36);
pcm.writeUInt32LE(LOOP * 4, 40);
for (let i = 0; i < LOOP; i++) {
  pcm.writeInt16LE(Math.round(L[i] * gain * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round(R[i] * gain * 32767), 46 + i * 4);
}
const wav = join(tmpdir(), `engagement-waltz-${process.pid}.wav`);
writeFileSync(wav, pcm);
mkdirSync(dirname(OUT), { recursive: true });
const ffmpeg = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '96k', OUT], {
  stdio: 'inherit',
});
rmSync(wav);
assert.equal(ffmpeg.status, 0, 'ffmpeg failed (is it installed and on PATH?)');

const seconds = LOOP / SR;
const dB = (v) => (20 * Math.log10(v)).toFixed(1);
console.log(
  `${OUT}: ${seconds.toFixed(1)} s, ${(statSync(OUT).size / 1024).toFixed(0)} KB, ` +
    `peak ${dB(PEAK)} dBFS, average ${dB(rms(L.subarray(0, LOOP)) * gain)} dBFS`,
);
