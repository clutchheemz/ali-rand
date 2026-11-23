import { useEffect, useState } from 'react';
import { eventStart } from '../lib/time';

/** Whole seconds left, rounded up so the display reads 0 exactly when the celebration starts. */
const secondsLeft = () => Math.max(0, Math.ceil((eventStart - Date.now()) / 1000));

export function EventCountdown() {
  const [left, setLeft] = useState(secondsLeft);

  useEffect(() => {
    // re-read the clock rather than counting ticks: stays right after the tab sleeps
    const id = window.setInterval(() => setLeft(secondsLeft()), 250);
    return () => window.clearInterval(id);
  }, []);

  const cells: [number, string][] = [
    [Math.floor(left / 86400), 'يوم'],
    [Math.floor((left % 86400) / 3600), 'ساعة'],
    [Math.floor((left % 3600) / 60), 'دقيقة'],
    [left % 60, 'ثانية'],
  ];

  return (
    <div className="countdown" role="timer" aria-label="الوقت المتبقي على الحفل">
      {cells.map(([value, label]) => (
        <div className="countdown__cell" key={label}>
          <span className="countdown__value" dir="ltr">
            {String(value).padStart(2, '0')}
          </span>
          <span className="countdown__label">{label}</span>
        </div>
      ))}
    </div>
  );
}
