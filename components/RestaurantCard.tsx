'use client';

import type { Restaurant } from '@/lib/scrapers/types';
import { PickButton } from './PickButton';
import { VoterStack } from './VoterStack';

function ArrowUpRight() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" style={{ marginLeft: 3, verticalAlign: 'baseline' }}>
      <path d="M5 4h7v7M11.5 4.5 4 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RestaurantCard({
  restaurant: r,
  voters,
  picked,
  isLeader,
  isTie,
  me,
  canVote,
  onToggle,
}: {
  restaurant: Restaurant;
  voters: string[];
  picked: boolean;
  isLeader: boolean;
  isTie: boolean;
  me: string | null;
  canVote: boolean;
  onToggle: () => void;
}) {
  const isError = !!r.error && r.items.length === 0;
  const classes = ['card'];
  if (isError) classes.push('card--error');
  if (picked) classes.push('card--picked');
  if (isLeader) classes.push('card--leader');

  const count = voters.length;
  const label = count === 0 ? 'VOTES' : count === 1 ? 'HLAS' : count < 5 ? 'HLASY' : 'HLASŮ';

  return (
    <article className={classes.join(' ')}>
      <span className="card-corner card-corner--tl" aria-hidden="true" />
      <span className="card-corner card-corner--tr" aria-hidden="true" />
      <span className="card-corner card-corner--bl" aria-hidden="true" />
      <span className="card-corner card-corner--br" aria-hidden="true" />

      {isLeader && (
        <span className="card-pick-badge">{isTie ? '[ TIE ]' : '[ WINNER ]'}</span>
      )}

      <div className="card-head-row">
        <h2 className="card-name">
          <span className="card-name-prefix">// </span>
          {r.name}
        </h2>
        <a className="card-web" href={r.url} target="_blank" rel="noopener noreferrer">
          [WEB]<ArrowUpRight />
        </a>
      </div>

      {r.soup && (
        <div className="soup">
          <span className="soup-stripe" aria-hidden="true" />
          <span className="soup-label">&gt; POLEVKA</span>
          <span className="soup-text">{r.soup}</span>
        </div>
      )}

      {r.extra && (
        <div className="extra">
          <span className="extra-stripe" aria-hidden="true" />
          <span className="extra-label">&gt; EXTRA</span>
          <span className="extra-text">{r.extra}</span>
        </div>
      )}

      {r.items.length > 0 ? (
        <div className="dishes">
          {r.items.map((item, i) => (
            <div key={i} className={`dish${i === r.items.length - 1 ? ' dish--last' : ''}`}>
              <div className="dish-desc">
                <span className="dish-bullet" aria-hidden="true">&gt;</span>
                {item.name}
              </div>
              <div className="dish-price">
                <span className="dish-price-num">{item.price.replace(/\s*Kč/i, '')}</span>
                <span className="dish-price-cur"> Kč</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
          {r.error ?? 'ŽÁDNÉ POLOŽKY'}
        </p>
      )}

      {!isError && (
        <div className="card-foot">
          <div className="card-foot-votes">
            <span className={`vote-count${count > 0 ? ' vote-count--on' : ''}`}>
              <span className="vote-count-num">{count}</span>
              <span className="vote-count-label">{label}</span>
            </span>
            <VoterStack names={voters} me={me} />
          </div>
          <PickButton slug={r.slug} picked={picked} disabled={!canVote} onToggle={onToggle} />
        </div>
      )}
    </article>
  );
}
