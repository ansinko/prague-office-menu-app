function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function VoterStack({ names, me }: { names: string[]; me: string | null }) {
  if (names.length === 0) {
    return <span className="voter-empty">// no votes</span>;
  }
  const visible = names.slice(0, 5);
  const overflow = names.length - visible.length;
  return (
    <span className="voter-stack" title={names.join(', ')}>
      {visible.map((n) => (
        <span
          key={n}
          className={`voter-chip${n === me ? ' voter-chip--me' : ''}`}
          title={n}
          aria-label={n}
        >
          [{initials(n)}]
        </span>
      ))}
      {overflow > 0 && (
        <span className="voter-chip voter-chip--more" title={names.slice(5).join(', ')}>
          +{overflow}
        </span>
      )}
    </span>
  );
}
