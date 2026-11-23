// The 1200 x 630 picture that WhatsApp and other apps show beside the link.
// Real text set by the browser (so the Arabic is shaped correctly), photographed by
// scripts/generate-brand-assets.mjs. Not part of the site build.
import { createRoot } from 'react-dom/client';
import '@fontsource/amiri/700.css';
import '@fontsource-variable/noto-naskh-arabic/index.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import './styles/base.css';
import './styles/scene.css';
import './styles/brand.css';
import { Flourish, Heart } from './components/Ornaments';
import { WaxSeal } from './components/WaxSeal';
import { event } from './config/event';

document.documentElement.dataset.theme = event.theme;

createRoot(document.getElementById('root')!).render(
  <div className="og">
    <div className="og__text">
      <WaxSeal className="og__seal" />
      <p className="og__caption">{event.text.cardCaption}</p>
      <p className="og__names">
        <span>{event.groom.ar}</span>
        <Heart />
        <span>{event.bride.ar}</span>
      </p>
      <Flourish />
      <p className="og__date">{event.text.dateLine}</p>
    </div>
  </div>,
);

// tells the script the fonts and pictures are in and the photograph can be taken
const faces = ['700 1em Amiri', '1em "Noto Naskh Arabic Variable"', 'italic 500 1em "Cormorant Garamond"'];
Promise.all([...faces.map((face) => document.fonts.load(face, 'أبجد Abc 123')), new Promise((done) => window.addEventListener('load', done))]).then(
  () => requestAnimationFrame(() => (document.body.dataset.ready = 'true')),
);
