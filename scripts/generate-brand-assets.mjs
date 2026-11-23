// Renders the link-preview picture and the icons into /public.
//
//   node scripts/generate-brand-assets.mjs     (uses the Chrome or Edge already installed on this machine)

import { readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const PORT = 5199;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  // 1200 x 630 JPEG: the size and format WhatsApp, Facebook and X expect
  await page.goto(`http://localhost:${PORT}/brand.html`);
  await page.waitForSelector('body[data-ready]');
  await page.screenshot({ path: 'public/og-image.jpg', type: 'jpeg', quality: 88 });

  // the paper colour of the chosen theme, for the home-screen icon's background
  const paper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());

  // icons, drawn from the same favicon.svg the browser tab uses
  const svg = readFileSync('public/favicon.svg', 'utf8');
  const icons = [
    { file: 'favicon-32.png', size: 32, fill: '100%', background: 'transparent' },
    { file: 'apple-touch-icon.png', size: 180, fill: '78%', background: paper }, // iOS wants an opaque square
  ];
  for (const icon of icons) {
    await page.setViewportSize({ width: icon.size, height: icon.size });
    await page.setContent(
      `<body style="margin:0;height:100vh;display:grid;place-items:center;background:${icon.background}">` +
        `<div style="width:${icon.fill};line-height:0">${svg}</div></body>`,
    );
    await page.screenshot({ path: `public/${icon.file}`, omitBackground: true });
  }
} finally {
  await browser.close();
  await server.close();
}

for (const file of ['og-image.jpg', 'favicon-32.png', 'apple-touch-icon.png']) {
  console.log(`public/${file}: ${(statSync(`public/${file}`).size / 1024).toFixed(0)} KB`);
}
