// Renders the embossed artwork into src/art.
//
//   npm run assets:art                               every piece in scripts/relief/pieces
//   npm run assets:art -- vine seal                  only these pieces
//   node scripts/generate-relief.mjs --src DIR --out DIR --preview DIR [--scale 3] [names]
//
// Uses the Chrome or Edge already installed on this machine. Previews of each piece laid over
// its material go to test-results/art.

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as kit from './relief/kit.mjs';
import { renderPieces } from './relief/render.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args.splice(i, 2)[1];
};
const src = path.resolve(option('src', 'scripts/relief/pieces'));
const out = path.resolve(option('out', 'src/art'));
const preview = path.resolve(option('preview', 'test-results/art'));
const scale = Number(option('scale', 0)) || undefined;

const files = readdirSync(src).filter((file) => file.endsWith('.mjs') && !file.startsWith('_'));
const pieces = [];
for (const file of files) {
  // the query string makes Node read the file afresh if this is run twice in one process
  const module = await import(`${pathToFileURL(path.join(src, file)).href}?${Date.now()}`);
  for (const piece of [].concat(module.default ?? [])) {
    if (!args.length || args.includes(piece.name)) pieces.push(piece);
  }
}
if (!pieces.length) {
  console.error(`No pieces found in ${src}${args.length ? ` named ${args.join(', ')}` : ''}`);
  process.exit(1);
}

const written = await renderPieces(pieces, { out, preview, kit, scale });
const total = written.reduce((sum, r) => sum + r.bytes + (r.maskBytes ?? 0), 0);
console.log(`${written.length} pictures, ${(total / 1024).toFixed(0)} KB in all -> ${out}`);
