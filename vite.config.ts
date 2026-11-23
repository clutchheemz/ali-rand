import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { event } from './src/config/event.ts';

// Public address of the deployed site, e.g. SITE_URL=https://example.com/
// WhatsApp only shows the preview image when og:image is an absolute URL.
const siteUrl = process.env.SITE_URL ? process.env.SITE_URL.replace(/\/*$/, '/') : '/';

// The paper colour of the chosen theme, read from the stylesheet so it is written down only once.
// It fills the browser's toolbar colour and the blank page shown for a moment before the envelope.
const paper = (() => {
  const css = readFileSync(new URL('./src/styles/base.css', import.meta.url), 'utf8');
  return css.match(new RegExp(`\\[data-theme='${event.theme}'\\][^{]*\\{[^}]*?--paper:\\s*(#[0-9a-f]{6})`))?.[1] ?? '#ffffff';
})();

/** Fills the social-preview tags from src/config/event.ts and preloads what the first screen needs. */
function invitation(): Plugin {
  return {
    name: 'invitation',

    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // the envelope's three fonts and its embossing start downloading with the HTML
        const built = Object.keys(ctx.bundle ?? {});
        const fonts = built.filter((file) =>
          /(amiri-arabic-700-normal|noto-naskh-arabic-arabic-wght-normal|cormorant-garamond-latin-500-italic).*\.woff2$/.test(file),
        );
        const art = built.filter((file) => /\/(seal|seal-mask|vine-[lr]|sprig-(top|bottom)-[lr])-[\w-]{8}\.(jpg|png)$/.test(file));
        return {
          html: html
            .replaceAll('__TITLE__', event.share.title)
            .replaceAll('__DESCRIPTION__', event.share.description)
            .replaceAll('__SITE_URL__', siteUrl)
            .replaceAll('__PAPER__', paper),
          tags: [
            ...fonts.map((file) => ({
              tag: 'link',
              attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `./${file}`, crossorigin: true },
              injectTo: 'head' as const,
            })),
            ...art.map((file) => ({
              tag: 'link',
              attrs: { rel: 'preload', as: 'image', href: `./${file}` },
              injectTo: 'head' as const,
            })),
          ],
        };
      },
    },
  };
}

export default defineConfig({
  base: './', // relative asset paths: the build works at a domain root or in a sub-folder
  plugins: [react(), invitation()],
});
