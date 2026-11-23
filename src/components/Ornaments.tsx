/** The heart between the two names. */
export function Heart() {
  return (
    <svg className="heart" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 21C5.2 15.8 2.5 12.5 2.5 9 2.5 6.2 4.7 4 7.4 4c1.9 0 3.6 1 4.6 2.7C13 5 14.7 4 16.6 4 19.3 4 21.5 6.2 21.5 9c0 3.5-2.7 6.8-9.5 12z" />
    </svg>
  );
}

/** A small embossed sprig that separates blocks of text. */
export function Flourish() {
  return <div className="flourish" aria-hidden="true" />;
}
