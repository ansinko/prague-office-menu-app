'use client';

export function PickButton({
  slug,
  picked,
  disabled,
  onToggle,
}: {
  slug: string;
  picked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`pick-btn${picked ? ' pick-btn--on' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={picked}
      title={disabled ? 'Nastav si nejprve své jméno' : undefined}
    >
      {picked ? '[×] MŮJ HLAS' : <>[ ] HLASOVAT <span className="pick-btn-arrow">→ {slug}</span></>}
    </button>
  );
}
