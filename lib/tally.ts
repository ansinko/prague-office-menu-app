import { pickFromTied } from './tiebreak';

export type VoteMap = Record<string, string[]>;

export interface WinnerResult {
  winnerSlug: string | null;
  topVotes: number;
  tiedCount: number;
  tiedSlugs: string[];
}

export function parseCsvVotes(raw: Record<string, string>): VoteMap {
  const out: VoteMap = {};
  for (const [voter, csv] of Object.entries(raw)) {
    out[voter] = csv.split(',').filter(Boolean);
  }
  return out;
}

export function computeTally(votes: VoteMap): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [voter, slugs] of Object.entries(votes)) {
    for (const slug of slugs) {
      const arr = m.get(slug) ?? [];
      arr.push(voter);
      m.set(slug, arr);
    }
  }
  return m;
}

export function computeWinner(tally: Map<string, string[]>, dateKey: string): WinnerResult {
  let topVotes = 0;
  for (const voters of tally.values()) {
    if (voters.length > topVotes) topVotes = voters.length;
  }
  if (topVotes === 0) {
    return { winnerSlug: null, topVotes: 0, tiedCount: 0, tiedSlugs: [] };
  }
  const tiedSlugs: string[] = [];
  for (const [slug, voters] of tally.entries()) {
    if (voters.length === topVotes) tiedSlugs.push(slug);
  }
  const winnerSlug = tiedSlugs.length === 1 ? tiedSlugs[0] : pickFromTied(tiedSlugs, dateKey);
  return { winnerSlug, topVotes, tiedCount: tiedSlugs.length, tiedSlugs };
}
