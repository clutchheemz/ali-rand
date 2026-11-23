import type { RefObject } from 'react';
import type { Stage } from '../App';
import { event } from '../config/event';
import { InteractiveEnvelope } from './InteractiveEnvelope';

type Props = {
  stage: Stage;
  onOpen(): void;
  buttonRef: RefObject<HTMLButtonElement | null>;
};

/** The first screen: the sealed envelope, edge to edge, with its title printed on the lid. */
export function EnvelopeScene({ stage, onOpen, buttonRef }: Props) {
  const gone = stage !== 'sealed' && stage !== 'opening';
  return (
    <section className="scene" aria-label={event.text.envelopeTitle} inert={gone}>
      <InteractiveEnvelope stage={stage} onOpen={onOpen} buttonRef={buttonRef}>
        <p className="scene__eyebrow" lang="en" dir="ltr">
          {event.groom.en} &amp; {event.bride.en}
        </p>
        <h1 className="scene__title">{event.text.envelopeTitle}</h1>
      </InteractiveEnvelope>
    </section>
  );
}
