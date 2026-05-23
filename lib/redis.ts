import { Redis } from '@upstash/redis';
import { pragueIsoDate } from './prague-time';

export const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export function todayKey(officeId: string): string {
  return `votes:${officeId}:${pragueIsoDate()}`;
}
