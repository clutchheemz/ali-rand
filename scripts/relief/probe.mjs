// Reads pixel values out of a picture: node probe.mjs file.jpg x,y x,y ...
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const [file, ...points] = process.argv.slice(2);
const data = readFileSync(file).toString('base64');
const mime = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
const page = await browser.newPage();
const out = await page.evaluate(
  async ({ src, points }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    const hist = {};
    for (let i = 0; i < px.length; i += 4) hist[px[i]] = (hist[px[i]] || 0) + 1;
    const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const values = Object.keys(hist).map(Number);
    return {
      size: [c.width, c.height],
      range: [Math.min(...values), Math.max(...values)],
      commonest: top.map(([v, n]) => `${v}: ${((n / (px.length / 4)) * 100).toFixed(1)}%`),
      at: points.map((p) => {
        const [x, y] = p.split(',').map(Number);
        const i = (y * c.width + x) * 4;
        return `${p} -> ${px[i]},${px[i + 1]},${px[i + 2]},${px[i + 3]}`;
      }),
    };
  },
  { src: `data:${mime};base64,${data}`, points },
);
console.log(JSON.stringify(out, null, 1));
await browser.close();
