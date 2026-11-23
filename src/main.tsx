import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';
import '@fontsource-variable/noto-naskh-arabic/index.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import './styles/base.css';
import './styles/scene.css';
import './styles/card.css';
import './styles/invitation.css';
import App from './App';
import { event } from './config/event';

document.documentElement.dataset.theme = event.theme;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
