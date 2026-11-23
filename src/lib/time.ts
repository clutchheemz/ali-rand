import { event } from '../config/event.ts';

/** The given date/time read as if it were UTC (ms). */
export function wallClock(date: string, time: string): number {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h, mi);
}

/** Wall-clock time in an IANA time zone -> the real instant (UTC ms). */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): number {
  const wall = wallClock(date, time);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const inZone = (ts: number) => {
    const p: Record<string, number> = {};
    for (const part of fmt.formatToParts(ts)) p[part.type] = Number(part.value);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  };
  let ts = wall;
  // two passes so a zone with daylight saving settles on the right offset
  for (let i = 0; i < 2; i++) ts = wall - (inZone(ts) - ts);
  return ts;
}

/** The moment the celebration starts (UTC ms). */
export const eventStart = zonedTimeToUtc(event.date, event.time, event.timeZone);
