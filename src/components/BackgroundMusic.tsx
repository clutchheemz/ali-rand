import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { event } from '../config/event';

export type MusicHandle = {
  /** Call from inside a tap or click handler: browsers refuse to play sound before a user gesture. */
  start(): void;
};

type State = 'off' | 'loading' | 'on' | 'error';

/** Looping instrumental with a round toggle in the corner. Nothing is downloaded until it is first played. */
export function BackgroundMusic({ ref }: { ref: Ref<MusicHandle> }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<State>('off');
  const mutedByGuest = useRef(false);
  const resumeOnReturn = useRef(false);

  const play = () => {
    const el = audio.current;
    if (!el || el.error) return; // a file that failed to load stays off; the invitation works without it
    el.volume = event.music.volume; // ignored on iOS, where the hardware buttons own the volume
    setState('loading');
    el.play().catch(() => {
      if (!el.error) setState('off'); // refused or interrupted; a load failure is reported by onError
    });
  };

  useImperativeHandle(ref, () => ({
    start() {
      if (!mutedByGuest.current && audio.current?.paused) play();
    },
  }));

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    mutedByGuest.current = !el.paused;
    if (el.paused) play();
    else el.pause();
  };

  // stay quiet while the page is in the background, pick up again on return
  useEffect(() => {
    const onVisibility = () => {
      const el = audio.current;
      if (!el) return;
      if (document.hidden) {
        resumeOnReturn.current = !el.paused;
        el.pause();
      } else if (resumeOnReturn.current && !mutedByGuest.current) {
        play();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const playing = state === 'on' || state === 'loading';
  return (
    <>
      <audio
        ref={audio}
        src={import.meta.env.BASE_URL + event.music.src}
        loop
        preload="none"
        onPlaying={() => setState('on')}
        onWaiting={() => setState('loading')}
        onPause={() => setState((s) => (s === 'error' ? s : 'off'))}
        onError={() => setState('error')}
      />
      <button
        type="button"
        className="orb music"
        data-state={state}
        aria-pressed={playing}
        aria-label={state === 'error' ? 'الموسيقى غير متاحة' : 'موسيقى الخلفية'}
        title={playing ? 'إيقاف الموسيقى' : 'تشغيل الموسيقى'}
        disabled={state === 'error'}
        onClick={toggle}
      >
        <span className="music__bars" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </button>
    </>
  );
}
