import { useState } from 'react';
import { event } from '../config/event';
import { Dialog } from './Dialog';

export function ShareInvitation() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { title, description } = event.share;
  // the invitation's own address, without any query string or #fragment
  const url = new URL('.', window.location.href).href;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt('انسخ رابط الدعوة', url); // clipboard blocked: let the guest copy by hand
    }
  };

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        <svg className="btn__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="6" cy="12" r="2.6" />
          <circle cx="17.5" cy="5.5" r="2.6" />
          <circle cx="17.5" cy="18.5" r="2.6" />
          <path d="M8.3 10.7l6.9-3.9M8.3 13.3l6.9 3.9" />
        </svg>
        {event.text.shareButton}
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setCopied(false);
        }}
        title={event.text.shareButton}
      >
        {'share' in navigator && (
          <button type="button" className="btn" onClick={() => navigator.share({ title, text: description, url }).catch(() => {})}>
            مشاركة عبر التطبيقات
          </button>
        )}
        <a
          className="btn"
          href={`https://wa.me/?text=${encodeURIComponent(`${title}\n${description}\n${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          واتساب
        </a>
        <button type="button" className="btn" onClick={copy}>
          <span aria-live="polite">{copied ? 'تم نسخ الرابط ✓' : 'نسخ رابط الدعوة'}</span>
        </button>
      </Dialog>
    </>
  );
}
