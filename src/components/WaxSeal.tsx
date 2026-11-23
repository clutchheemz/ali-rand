/**
 * The burgundy wax seal with its rose. The wax is one flat colour; the relief picture laid
 * over it supplies every highlight and shadow, and a silhouette cuts it to the poured shape.
 */
export function WaxSeal({ className = '' }: { className?: string }) {
  return (
    <div className={`seal ${className}`} aria-hidden="true">
      <i className="seal__shadow" />
      <i className="seal__ring" />
      <i className="seal__wax" />
    </div>
  );
}
