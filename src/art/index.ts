// The embossed pictures in this folder are drawn and lit by scripts/generate-relief.mjs
// (npm run assets:art). The stylesheets use them as backgrounds; they are imported here only
// so the page can wait for the ones on the first screen before it shows the envelope.
import seal from './seal.jpg';
import sealMask from './seal-mask.png';
import sprigBottomL from './sprig-bottom-l.jpg';
import sprigBottomR from './sprig-bottom-r.jpg';
import sprigTopL from './sprig-top-l.jpg';
import sprigTopR from './sprig-top-r.jpg';
import vineL from './vine-l.jpg';
import vineR from './vine-r.jpg';

export const firstScreenArt = [seal, sealMask, vineL, vineR, sprigTopL, sprigTopR, sprigBottomL, sprigBottomR];
