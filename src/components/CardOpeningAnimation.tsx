/** The bow is one picture shown through five windows, so that each part can move on its own. */
const BOW_PARTS = ['tail-l', 'tail-r', 'loop-l', 'loop-r', 'knot'];

/**
 * The moving parts that hold the card shut: two lengths of satin ribbon that meet in the
 * middle, and the bow tied over the join. The stylesheet unties them when the stage changes:
 * the tails are pulled, each loop runs back through the knot, the knot falls open, and each
 * length slides off its own side of the card.
 */
export function CardOpeningAnimation() {
  return (
    <>
      <div className="wrap__half wrap__half--l">
        <i />
      </div>
      <div className="wrap__half wrap__half--r">
        <i />
      </div>
      <div className="wrap__bow">
        <div className="bow">
          {BOW_PARTS.map((part) => (
            <i key={part} className={`bow__part bow__part--${part}`} />
          ))}
        </div>
      </div>
    </>
  );
}
