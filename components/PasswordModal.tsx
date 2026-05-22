'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicOffice } from '@/lib/offices';
import { unlockOffice } from '@/lib/auth';

export function PasswordModal({
  office,
  onCancel,
}: {
  office: PublicOffice;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await unlockOffice(office.id, draft);
      if (res.ok) {
        router.push(`/office/${office.id}`);
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => setShake(false), 420);
      }
    });
  };

  return (
    <div className="pwd-backdrop" onMouseDown={onCancel}>
      <form
        className={'pwd-modal pwd-modal--matrix' + (shake ? ' pwd-modal--shake' : '')}
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="pwd-corner pwd-corner--tl" aria-hidden="true" />
        <span className="pwd-corner pwd-corner--tr" aria-hidden="true" />
        <span className="pwd-corner pwd-corner--bl" aria-hidden="true" />
        <span className="pwd-corner pwd-corner--br" aria-hidden="true" />
        <div className="pwd-term-line">
          <span>$ ssh {office.id}@menu</span>
          <span className="pwd-term-status">[AUTH]</span>
        </div>
        <div className="pwd-head">
          <div className="pwd-lock" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="pwd-head-text">
            <div className="pwd-eyebrow">[ RESTRICTED ]</div>
            <h2 className="pwd-title">{office.name}</h2>
            <div className="pwd-sub">{office.address}</div>
          </div>
        </div>
        <label className="pwd-field">
          <span className="pwd-label">$ password:</span>
          <input
            ref={inputRef}
            type="password"
            className={'pwd-input' + (error ? ' pwd-input--error' : '')}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(false); }}
            placeholder="************"
            autoComplete="off"
            spellCheck={false}
          />
          {error && <span className="pwd-err">// ACCESS DENIED</span>}
        </label>
        <div className="pwd-actions">
          <button type="button" className="pwd-btn" onClick={onCancel}>[ esc ]</button>
          <button type="submit" className="pwd-btn pwd-btn--primary" disabled={pending}>
            {pending ? '[ ... ]' : '[ enter ]'}
          </button>
        </div>
      </form>
    </div>
  );
}
