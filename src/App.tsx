import { useEffect, useRef, useState } from 'react';
import { firstScreenArt } from './art';
import { BackgroundMusic, type MusicHandle } from './components/BackgroundMusic';
import { EnvelopeScene } from './components/EnvelopeScene';
import { InvitationCard } from './components/InvitationCard';
import { InvitationContent } from './components/InvitationContent';
import { event } from './config/event';

/**
 * sealed -> opening -> card -> unfolding -> open
 *                       ^--- closing <------'      (tie the card up again)
 * open -> resetting -> sealed                      (replay from the start)
 *
 * sealed     the envelope fills the screen
 * opening    its lid lifts, the envelope drops away
 * card       the card lies there, tied with a ribbon
 * unfolding  the bow is untied, the ribbon slides off, the words arrive
 * open       the invitation can be read and scrolled
 */
export type Stage = 'sealed' | 'opening' | 'card' | 'unfolding' | 'open' | 'closing' | 'resetting';

/** Length of each animated stage in ms. Keep in step with the timings in src/styles. */
const FULL = { opening: 3000, unfolding: 3000, closing: 1500, resetting: 450 };
const REDUCED = { opening: 700, unfolding: 700, closing: 450, resetting: 250 };
const duration = (stage: keyof typeof FULL) =>
  (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? REDUCED : FULL)[stage];

const picture = (src: string) => {
  const img = new Image();
  img.src = src;
  return img.decode();
};

export default function App() {
  const [stage, setStageState] = useState<Stage>('sealed');
  const [ready, setReady] = useState(false);
  const current = useRef<Stage>('sealed');
  const timer = useRef(0);
  const music = useRef<MusicHandle>(null);
  const envelopeButton = useRef<HTMLButtonElement>(null);
  const cardButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  const setStage = (next: Stage) => {
    current.current = next;
    setStageState(next);
  };

  /** One animated step. Ignored unless we are resting at `from`, so a double tap cannot fire it twice. */
  const step = (from: Stage, via: keyof typeof FULL, to: Stage) => {
    if (current.current !== from) return;
    setStage(via);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStage(to), duration(via));
  };

  const openEnvelope = () => {
    music.current?.start(); // inside the tap handler: browsers only allow sound after a gesture
    step('sealed', 'opening', 'card');
  };
  const openCard = () => {
    music.current?.start();
    step('card', 'unfolding', 'open');
  };
  const closeCard = () => step('open', 'closing', 'card');
  const replay = () => step('open', 'resetting', 'sealed');

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // show the envelope once its fonts and embossing are in, so nothing pops in or jumps
  useEffect(() => {
    const show = () => {
      setReady(true);
      document.getElementById('boot')?.remove();
    };
    // The envelope shows three faces, each in one script. Waiting for exactly those files keeps
    // the first screen from being held back by the Latin letters and digits the invitation uses.
    const scene: [string, string][] = [
      ['700 1em Amiri', event.text.envelopeTitle],
      ['1em "Noto Naskh Arabic Variable"', event.text.envelopeHint],
      ['italic 500 1em "Cormorant Garamond"', `${event.groom.en} & ${event.bride.en}`],
    ];
    // everything else is fetched behind the envelope, while the guest is still looking at it
    const invitation = ['1em Amiri', '700 1em Amiri', '1em "Noto Naskh Arabic Variable"', '500 1em "Cormorant Garamond"'];
    Promise.all([...scene.map(([face, sample]) => document.fonts.load(face, sample)), ...firstScreenArt.map(picture)])
      .then(show, show)
      .then(() => invitation.forEach((face) => document.fonts.load(face, 'أبجد Abc 0123456789')));
    const giveUp = window.setTimeout(show, 2500); // never hold the page back for a slow file
    return () => window.clearTimeout(giveUp);
  }, []);

  // keyboard and screen-reader users land on the next thing they can act on
  const lastStage = useRef(stage);
  useEffect(() => {
    if (lastStage.current === stage) return;
    lastStage.current = stage;
    const target = { sealed: envelopeButton, card: cardButton, open: sheet }[stage as 'sealed' | 'card' | 'open'];
    target?.current?.focus({ preventScroll: true });
  }, [stage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) closeCard();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardOpen = stage === 'unfolding' || stage === 'open' || stage === 'resetting';

  return (
    <div className="app" data-stage={stage} data-card={cardOpen ? 'open' : 'closed'} data-ready={ready}>
      {/* back to front: the invitation, the ribbon that ties it, the envelope that holds it */}
      <div className="stage">
        <InvitationContent stage={stage} onClose={closeCard} onReplay={replay} scroller={sheet} />
        <InvitationCard stage={stage} onOpen={openCard} buttonRef={cardButton} />
        <EnvelopeScene stage={stage} onOpen={openEnvelope} buttonRef={envelopeButton} />
        <BackgroundMusic ref={music} />
        <div className="veil" aria-hidden="true" />
      </div>
    </div>
  );
}
