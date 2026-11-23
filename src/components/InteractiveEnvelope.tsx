import type { ReactNode, RefObject } from 'react';
import type { Stage } from '../App';
import { event } from '../config/event';
import { WaxSeal } from './WaxSeal';

type Props = {
  stage: Stage;
  onOpen(): void;
  buttonRef: RefObject<HTMLButtonElement | null>;
  /** What is printed on the lid. */
  children: ReactNode;
};

/**
 * The edge of a flap where it lies on the paper beneath: a soft shadow, the cut line and a
 * thread of light. Drawn in a 100 x 100 box stretched over the screen, with strokes that
 * keep their width, so the lines always run exactly into the corners.
 */
function Crease({ d }: { d: string }) {
  return (
    <>
      {['shade', 'line', 'light'].map((kind) => (
        <svg key={kind} className={`crease crease--${kind}`} viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          <path d={d} />
        </svg>
      ))}
    </>
  );
}

/**
 * An envelope seen from the back, filling the screen: two side flaps, the bottom flap over
 * them, and the lid folded down over all three and sealed with wax. The lid is hinged along
 * the top of the screen; the other three flaps are glued into one pocket.
 * The card is not in here: it is the page underneath, uncovered as the envelope leaves.
 */
export function InteractiveEnvelope({ stage, onOpen, buttonRef, children }: Props) {
  return (
    <div className="env">
      <div className="pocket" aria-hidden="true">
        <div className="env__inside" />
        {/* the shadow the mouth of the envelope throws on the card inside; the flaps cover its outer half */}
        <svg className="crease crease--shade" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          <path d="M0 0L50 51L100 0" />
        </svg>
        <div className="flap flap--left" />
        <div className="flap flap--right" />
        <Crease d="M0 100L50 49L100 100" />
        <div className="flap flap--bottom" />
        <div className="lid-shadow">
          <i />
        </div>
      </div>

      <div className="lid">
        <div aria-hidden="true">
          <Crease d="M0 0L50 52L100 0" />
          <div className="lid__paper" />
          <div className="lid__shade" />
        </div>
        <header className="lid__title">{children}</header>
        <WaxSeal />
      </div>

      {/* the button carries these same words as its label, so the visible copy is decorative */}
      <p className="env__hint" aria-hidden="true">
        {event.text.envelopeHint}
      </p>
      <button
        ref={buttonRef}
        type="button"
        className="env-hit"
        aria-label={event.text.envelopeHint}
        disabled={stage !== 'sealed'}
        onClick={onOpen}
      />
    </div>
  );
}
