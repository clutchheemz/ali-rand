# Ali & Rand: engagement invitation

A full-screen interactive invitation in blind-embossed blush paper. The guest sees a sealed
envelope that fills the screen: four flaps pressed with flowering sprays, closed by a burgundy
wax seal. A tap lifts the lid and the envelope drops away, leaving a card tied with a satin
ribbon. A second tap undoes the bow, the ribbon slides off, and the invitation appears inside an
arched, beaded frame with roses in its corners. Below it the page scrolls on: the day behind a
pair of sculpted curtains, the countdown, the place with its map link, and the closing line.

React, TypeScript and Vite. No backend, no tracking, no accounts.

## Change the event details

Everything a guest reads comes from one file: [`src/config/event.ts`](src/config/event.ts).
Names, date, time, time zone, venue, map link, every line of invitation text, the share title and
description, and the music file are all there. Edit it, then publish again (below).

- The countdown is worked out from `date`, `time` and `timeZone`, so it reaches zero at the
  right moment whatever time zone a guest's phone is set to.
- The Quranic verse is stored exactly as supplied. Keep it character for character.
- After changing names, caption or date, refresh the link-preview picture: `npm run assets:brand`.
- To use different music, replace `public/audio/engagement-waltz.mp3` (or point `music.src` at
  another file in `public/`). Keep it quiet: iPhones ignore the page's volume setting.

## Change the colours

`theme` in [`src/config/event.ts`](src/config/event.ts) picks the paper: `'blush'` (pale rose) or
`'ivory'` (warm white). Each palette is a short list of colours at the top of
[`src/styles/base.css`](src/styles/base.css): paper, ink, wax, ribbon, the countdown band.

The embossing is colourless: each picture in `src/art/` only says where the surface catches the
light and where it falls into shade, and the page presses it into whatever colour lies
underneath. So changing a colour there recolours everything, embossing included, with no
pictures to redo. After changing the theme, refresh the link-preview picture and the icons:
`npm run assets:brand`.

## Run it

```
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
npm run test:e2e     # full guest journey on six screen sizes (run the build first)
```

The test run needs Chrome or Edge installed. It writes screenshots to `test-results/` and a
summary to [`TEST-REPORT.md`](TEST-REPORT.md). To test the live site instead of the local build:
`npm run test:e2e -- https://your-address/` (report in `TEST-REPORT-LIVE.md`).

## Publish

This invitation is live at **https://clutchheemz.github.io/ali-rand/**, served by GitHub Pages
from the `gh-pages` branch of the repository `clutchheemz/ali-rand`. To publish a change:

```
node scripts/deploy-github-pages.mjs clutchheemz ali-rand
```

GitHub takes a minute or two to show the new version. The `gh-pages` branch holds only the built
site and is replaced on every publish; the source (this folder) is kept on the `main` branch of
the same repository. After a change, save it there too:

```
git add --all
git commit -m "Describe the change"
git push
```

To publish somewhere else: the build is a folder of static files, so any static host works. Two
things matter:

1. Build with the public address, so WhatsApp can find the preview picture:
   `SITE_URL=https://your-address/ npm run build` (PowerShell: `$env:SITE_URL='https://your-address/'; npm run build`).
2. Upload the contents of `dist/`.

For GitHub Pages both steps are one command:

```
npm run deploy -- <github-user> <repository>
```

It builds for `https://<github-user>.github.io/<repository>/` and pushes only the built site to
that repository's `gh-pages` branch, replacing the previous version.

WhatsApp caches previews. After changing the picture or text, a link that was already shared may
keep its old preview for a while; adding `?v=2` to the link forces a fresh one.

## The embossed artwork

Every flower, the wax seal, the ribbon, the frame and the curtains are drawn by code, not
photographed or generated. Each piece in [`scripts/relief/pieces/`](scripts/relief/pieces) draws a
height map (black is the level of the paper, white is the highest point). `npm run assets:art`
lights each height map from the top left, once, with Chrome's lighting filters, and saves the
result into `src/art/` as a small grey picture; a preview of every piece on its material goes to
`test-results/art/`. The page lays those pictures over the paper with a hard-light blend.

- Redraw one piece: edit its file, then `npm run assets:art -- vine` (the piece's name).
- How deep, soft or glossy each material looks is set in
  [`scripts/relief/render.mjs`](scripts/relief/render.mjs).
- The pictures are lit ahead of time rather than in the guest's browser so they look the same on
  every phone and cost nothing to draw.
- Two other flower sets were drawn and are kept in `scripts/relief/alternates/`: `roses` (Damask
  roses throughout) and `lace` (fine jasmine and orange blossom). To try one:
  `node scripts/generate-relief.mjs --src scripts/relief/alternates/roses`. It replaces the vine, sprig
  and corner pictures; `npm run assets:art` brings the current set back.
- A relief picture must sit at least 3px inside the element it is blended into, or a hairline box
  appears round it on most phones (see the note on `.flourish` in `src/styles/base.css`). The test
  run checks for this on a screen with a fractional pixel ratio.

## What is where

```
src/config/event.ts            every event detail and line of text
src/App.tsx                    the stages: sealed, opening, card, unfolding, open
src/components/
  EnvelopeScene.tsx            the first screen: the envelope and the title printed on its lid
  InteractiveEnvelope.tsx      four flaps, the hinged lid, the tap that opens it
  WaxSeal.tsx                  the burgundy seal
  InvitationCard.tsx           the ribbon-tied card: lean, press and the tap that unties it
  CardOpeningAnimation.tsx     the two lengths of ribbon and the bow
  InvitationContent.tsx        the invitation page and its sections
  BackgroundMusic.tsx          music and its toggle
  EventCountdown.tsx  EventLocation.tsx  ShareInvitation.tsx
src/styles/                    scene.css and card.css hold the animation timings
src/art/                       the embossed pictures (made by npm run assets:art)
src/lib/                       time-zone maths for the countdown
scripts/
  generate-relief.mjs  relief/ draws and lights the embossed artwork
  generate-music.mjs           composes and renders the music (original, nothing to license)
  generate-brand-assets.mjs    link-preview picture and icons
  e2e.mjs                      the test run
  deploy-github-pages.mjs      build and publish
```

Animation lengths appear twice: the stage durations at the top of `src/App.tsx` and the matching
timings in `src/styles/scene.css`, `card.css` and `invitation.css`. Change them together.

## Music

`public/audio/engagement-waltz.mp3` is an original 80-second waltz written and synthesised by
`scripts/generate-music.mjs` (soft piano, pad, celesta). It contains no samples or third-party
material. It starts on the guest's first tap, never before, and the round button in the corner
mutes and unmutes it.
