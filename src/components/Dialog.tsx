import { useEffect, useRef, type ReactNode } from 'react';

type Props = { open: boolean; onClose(): void; title: string; children: ReactNode };

/** Bottom sheet on the native <dialog>: the browser supplies the focus trap, Escape and backdrop. */
export function Dialog({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.open === open) return;
    // browsers from before 2022 have no <dialog> methods: fall back to showing it in place
    if (!el.showModal) el.toggleAttribute('open', open);
    else if (open) {
      el.showModal();
      // a neutral first stop: after a tap, Safari would otherwise ring the first choice as if it were chosen
      heading.current?.focus();
    } else el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onClose={onClose}
      // the dialog fills the screen and is transparent, so a click on it (not the panel) is a click outside
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dialog__panel paper">
        <h2 className="dialog__title" ref={heading} tabIndex={-1}>
          {title}
        </h2>
        {children}
        <button type="button" className="link" onClick={onClose}>
          إغلاق
        </button>
      </div>
    </dialog>
  );
}
