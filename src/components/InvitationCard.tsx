import { useEffect, useRef, type RefObject } from 'react';
import type { Stage } from '../App';
import { event } from '../config/event';
import { CardOpeningAnimation } from './CardOpeningAnimation';

type Props = { stage: Stage; onOpen(): void; buttonRef: RefObject<HTMLButtonElement | null> };

const TILT_VARS = ['--tx', '--ty', '--press'];

/**
 * The card as the envelope leaves it: the first screen of the invitation, tied shut with a
 * ribbon. This layer is only the ribbon, its bow and the tap that unties them; the embossed
 * card itself is the page underneath.
 */
export function InvitationCard({ stage, onOpen, buttonRef }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const live = stage === 'card';

  // the bow leans toward the finger or cursor and gives when pressed, like cloth
  useEffect(() => {
    const el = wrap.current;
    if (!el || !live || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lean = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const clamp = (v: number) => Math.max(-1, Math.min(1, v)).toFixed(2);
      el.style.setProperty('--tx', clamp(((e.clientX - box.left) / box.width) * 2 - 1));
      el.style.setProperty('--ty', clamp(((e.clientY - box.top) / box.height) * 2 - 1));
      el.style.setProperty('--press', e.buttons ? '0.96' : '1');
    };
    const rest = () => TILT_VARS.forEach((name) => el.style.removeProperty(name));
    const leanOn = ['pointerdown', 'pointermove'] as const;
    const restOn = ['pointerup', 'pointerleave', 'pointercancel'] as const;
    leanOn.forEach((type) => el.addEventListener(type, lean));
    restOn.forEach((type) => el.addEventListener(type, rest));
    return () => {
      leanOn.forEach((type) => el.removeEventListener(type, lean));
      restOn.forEach((type) => el.removeEventListener(type, rest));
      rest();
    };
  }, [live]);

  return (
    <div className="wrap" ref={wrap} inert={!live}>
      <div aria-hidden="true">
        <CardOpeningAnimation />
        {/* the button carries these same words as its label */}
        <p className="wrap__hint">{event.text.cardHint}</p>
      </div>
      <button
        ref={buttonRef}
        type="button"
        className="card__hit"
        aria-label={event.text.cardHint}
        disabled={!live}
        onClick={onOpen}
      />
    </div>
  );
}
