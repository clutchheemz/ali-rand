import { event } from '../config/event';

export function EventLocation() {
  return (
    <div className="location">
      <p className="location__name">{event.venue.name}</p>
      <p className="location__area">{event.venue.area}</p>
      {/* a new tab, so the opened invitation is still here when the guest comes back */}
      <a className="btn" href={event.venue.mapsUrl} target="_blank" rel="noopener noreferrer">
        <svg className="btn__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
        {event.text.mapButton}
      </a>
    </div>
  );
}
