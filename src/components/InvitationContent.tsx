import { useEffect, type CSSProperties, type RefObject } from 'react';
import type { Stage } from '../App';
import { event } from '../config/event';
import { EventCountdown } from './EventCountdown';
import { EventLocation } from './EventLocation';
import { Flourish, Heart } from './Ornaments';
import { ShareInvitation } from './ShareInvitation';

type Props = {
  stage: Stage;
  onClose(): void;
  onReplay(): void;
  scroller: RefObject<HTMLDivElement | null>;
};

/**
 * The invitation: one long sheet of embossed paper. Its first screen is the card that came out
 * of the envelope (rose corners, the arched frame, the invitation itself); below it come the
 * day behind its curtains, the countdown, the place, and the closing line.
 */
export function InvitationContent({ stage, onClose, onReplay, scroller }: Props) {
  // every way back to the tied card or the envelope starts from the top of the page
  useEffect(() => {
    if (stage !== 'open') scroller.current?.scrollTo(0, 0);
  }, [stage, scroller]);

  // sections below the card rise into place the first time they are scrolled to
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const blocks = root.querySelectorAll('.rise');
    if (!('IntersectionObserver' in window)) {
      blocks.forEach((el) => el.classList.add('is-seen'));
      return;
    }
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-seen');
          watcher.unobserve(entry.target);
        }
      },
      { root, rootMargin: '0px 0px -12% 0px' },
    );
    blocks.forEach((el) => watcher.observe(el));
    return () => watcher.disconnect();
  }, [scroller]);

  // on the card, each line arrives a beat after the one before it
  let order = 0;
  const reveal = (className: string) => ({ className: `reveal ${className}`, style: { '--i': order++ } as CSSProperties });
  const t = event.text;

  return (
    <main className="sheet" aria-label={event.share.title} inert={stage !== 'open'}>
      <button type="button" className="orb sheet__close" aria-label="إغلاق بطاقة الدعوة" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
        </svg>
      </button>

      <div className="sheet__scroll" ref={scroller} tabIndex={-1}>
        <section className="hero">
          <div className="hero__text">
            <p {...reveal('hero__bismillah')}>{t.bismillah}</p>
            <p {...reveal('hero__verse')}>{t.verse}</p>
            <div {...reveal('under')}>
              <Flourish />
            </div>
            <p {...reveal('hero__lead')}>
              {t.intro[0]}
              <br />
              {t.intro[1]}
            </p>
            <h2 {...reveal('hero__names')} aria-label={event.namesAr}>
              <span>{event.groom.ar}</span>
              <Heart />
              <span>{event.bride.ar}</span>
            </h2>
            <p {...reveal('hero__latin')} lang="en" dir="ltr">
              {event.groom.en} &amp; {event.bride.en}
            </p>
          </div>
          <svg className="hero__cue" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 9l7 7 7-7" />
          </svg>
        </section>

        <section className="day">
          <div className="rise">
            <p className="day__line">{t.dayLine}</p>
            <p className="day__date">{t.dateLine}</p>
            <p className="day__line">{t.timeLine}</p>
          </div>
          <Flourish />
        </section>

        <section className="count">
          <h3 className="count__title rise">{t.countdownTitle}</h3>
          <div className="rise">
            <EventCountdown />
          </div>
        </section>

        <section className="place">
          <div className="medallion rise" aria-hidden="true" />
          <h3 className="place__title rise">{t.venueTitle}</h3>
          <div className="rise">
            <EventLocation />
          </div>
        </section>

        <section className="closing">
          <div className="closing__card rise">
            <Flourish />
            <p className="closing__line">{t.closing}</p>
            <ShareInvitation />
            <div className="sheet__footer">
              <button type="button" className="link" onClick={onClose}>
                إغلاق البطاقة
              </button>
              <button type="button" className="link" onClick={onReplay}>
                إعادة العرض من البداية
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
