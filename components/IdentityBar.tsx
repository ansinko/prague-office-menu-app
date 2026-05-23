'use client';

import { FormEvent, useState } from 'react';
import { MAX_NAME_LEN, normalizeIdentityName } from '@/lib/identity';

export function IdentityBar({
  me,
  onSet,
}: {
  me: string | null;
  onSet: (name: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = normalizeIdentityName(draft);
    if (!name) return;
    onSet(name);
    setDraft('');
    setEditing(false);
  };

  if (!me || editing) {
    return (
      <form className="identity-bar" onSubmit={submit}>
        <span className="identity-label">$ whoami</span>
        <input
          className="identity-input"
          autoFocus
          maxLength={MAX_NAME_LEN}
          placeholder="enter name…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="identity-btn">[ enter ]</button>
        {editing && (
          <button
            type="button"
            className="identity-btn identity-btn--ghost"
            onClick={() => {
              setEditing(false);
              setDraft('');
            }}
          >
            [ esc ]
          </button>
        )}
      </form>
    );
  }

  return (
    <div className="identity-bar">
      <span className="identity-label">$ whoami</span>
      <span className="identity-name">{me}</span>
      <button
        type="button"
        className="identity-btn"
        onClick={() => {
          setDraft(me);
          setEditing(true);
        }}
      >
        [ rename ]
      </button>
    </div>
  );
}
