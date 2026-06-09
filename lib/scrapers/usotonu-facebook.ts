import { isPragueWeekend } from '../prague-time';
import type { MenuItem } from './types';

export interface UsotonuMenuPayload {
  soup: string | null;
  extra: string | null;
  items: MenuItem[];
}

export interface FacebookArticleImageCandidate {
  src: string;
  alt: string;
  width: number;
  height: number;
  articleTop: number;
}

const DEFAULT_FACEBOOK_URL = 'https://www.facebook.com/USotonu';
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_GEMINI_ATTEMPTS = 4;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FACEBOOK_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'cs-CZ,cs;q=0.9,sk;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') return null;
  return trimmed;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function decodeEscapedUrl(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\\\//g, '/')
    .replace(/\\u0025/gi, '%')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u003f/gi, '?')
    .replace(/\\u002f/gi, '/');
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function geminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return apiKey;
}

function rawGeminiText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (!raw || typeof raw !== 'object') {
    throw new Error('Gemini response is not an object');
  }

  const candidate = (raw as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
  }).candidates?.[0];
  const text = candidate?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
  if (typeof text !== 'string') {
    throw new Error('Gemini response did not include text');
  }
  return text;
}

function normalizeMenuPayload(value: unknown): UsotonuMenuPayload {
  if (!value || typeof value !== 'object') {
    throw new Error('Gemini menu payload is not an object');
  }

  const raw = value as { soup?: unknown; extra?: unknown; items?: unknown };
  if (!Array.isArray(raw.items)) {
    throw new Error('Gemini menu payload is missing items');
  }

  const items = raw.items.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const row = item as { name?: unknown; price?: unknown };
    const name = cleanText(row.name);
    const price = cleanText(row.price);
    return name && price ? { name, price } : null;
  });

  if (items.some((item) => item === null)) {
    throw new Error('Gemini menu payload contains invalid rows; expected valid menu items');
  }

  const normalized = {
    soup: cleanText(raw.soup),
    extra: cleanText(raw.extra),
    items: items.filter((item): item is MenuItem => item !== null),
  };

  if (!normalized.soup && normalized.items.length === 0) {
    throw new Error('Gemini returned an empty menu');
  }

  return normalized;
}

export function parseGeminiMenuResponse(raw: unknown): UsotonuMenuPayload {
  const text = stripJsonFence(rawGeminiText(raw));
  return normalizeMenuPayload(JSON.parse(text));
}

export function extractFacebookImageCandidates(html: string): string[] {
  const normalized = decodeEscapedUrl(html);
  const candidates = new Set<string>();
  const urlRe = /https:\/\/[^"'<>\\\s]+?(?:(?:jpe?g|png|webp)(?:\?[^"'<>\\\s]*)?|media\/\?media_id=\d+[^"'<>\\\s]*)/gi;
  let match: RegExpExecArray | null;

  while ((match = urlRe.exec(normalized)) !== null) {
    const url = decodeEscapedUrl(match[0]).replace(/[),.]+$/g, '');
    if (isLikelyFacebookImage(url)) candidates.add(url);
  }

  return [...candidates];
}

function isLikelyFacebookImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host.includes('fbcdn.net') ||
      host.includes('fbsbx.com') ||
      host.includes('facebook.com')
    );
  } catch {
    return false;
  }
}

function imageScore(url: string, index: number): number {
  const lower = decodeURIComponent(url).toLowerCase();
  let score = 1000 - index;
  if (/denn[ií]|obed|ob[eě]d|menu|poledn/.test(lower)) score += 800;
  if (/scontent|fbcdn|fbsbx/.test(lower)) score += 200;
  if (/\/v\/t39\.30808-6\//.test(lower)) score += 700;
  if (/\.(?:jpe?g|png|webp)(?:[?&]|$)/.test(lower)) score += 100;
  if (/\/v\/t39\.30808-1\//.test(lower)) score -= 900;
  if (/ctp=s(?:24|32|40|200)x(?:24|32|40|200)/.test(lower)) score -= 500;
  if (/profile|avatar|logo|cover|emoji|static|rsrc\.php/.test(lower)) score -= 600;
  return score;
}

export function selectBestFacebookImageCandidate(candidates: string[]): string | null {
  return candidates
    .map((url, index) => ({ url, score: imageScore(url, index) }))
    .sort((a, b) => b.score - a.score)[0]?.url ?? null;
}

export function selectBestArticleImageCandidate(candidates: FacebookArticleImageCandidate[]): string | null {
  return candidates
    .filter((image) => {
      const alt = image.alt.toLowerCase();
      return (
        image.src.includes('fbcdn') &&
        image.width >= 350 &&
        image.height >= 250 &&
        !alt.includes('profile') &&
        !alt.includes('cover')
      );
    })
    .sort((a, b) => a.articleTop - b.articleTop)[0]?.src ?? null;
}

function facebookUrls(): string[] {
  const raw = process.env.USOTONU_FACEBOOK_URL?.trim() || DEFAULT_FACEBOOK_URL;
  const urls = new Set<string>([raw]);

  try {
    const parsed = new URL(raw);
    const path = parsed.pathname.replace(/\/+$/, '');
    urls.add(`${parsed.origin}${path}/photos`);
    urls.add(`https://m.facebook.com${path}`);
    urls.add(`https://m.facebook.com${path}/photos`);
  } catch {
    // Keep the raw URL. The fetch step will report the invalid value.
  }

  return [...urls];
}

async function fetchFacebookPageHtml(): Promise<string> {
  const errors: string[] = [];

  for (const url of facebookUrls()) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: FACEBOOK_HEADERS,
      });
      if (!res.ok) {
        errors.push(`${url}: HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      if (html) return html;
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : 'fetch failed'}`);
    }
  }

  throw new Error(`Facebook fetch failed (${errors.join('; ')})`);
}

async function downloadImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': UA,
      Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*',
      Referer: process.env.USOTONU_FACEBOOK_URL?.trim() || DEFAULT_FACEBOOK_URL,
    },
  });

  if (!res.ok) throw new Error(`Image download failed: HTTP ${res.status}`);
  const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1024) throw new Error('Downloaded image is too small');
  return { base64: bytes.toString('base64'), mimeType };
}

async function findLatestFeedImageWithPlaywright(): Promise<{ base64: string; mimeType: string }> {
  if (process.env.VERCEL) {
    throw new Error('Playwright disabled on Vercel runtime');
  }
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('Playwright is not installed');
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 1000 },
      userAgent: UA,
    });
    const page = await context.newPage();
    const url = process.env.USOTONU_FACEBOOK_URL?.trim() || DEFAULT_FACEBOOK_URL;

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(6_000);

    for (const text of [
      'Allow all cookies',
      'Accept all',
      'Povoliť všetky cookies',
      'Prijať všetko',
      'Not now',
      'Teraz nie',
      'Close',
      'Zavrieť',
    ]) {
      try {
        const button = page.getByText(text, { exact: false }).first();
        if (await button.isVisible({ timeout: 1_000 })) {
          await button.click();
          await page.waitForTimeout(1_000);
        }
      } catch {
        // Facebook frequently changes or hides these dialogs.
      }
    }

    for (let i = 0; i < 5; i += 1) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(1_500);
    }

    const candidates = await page.evaluate(() => {
      const articles = [...document.querySelectorAll('[role="article"]')];
      const results: FacebookArticleImageCandidate[] = [];

      for (const article of articles) {
        const articleBox = article.getBoundingClientRect();
        const imgs = [...article.querySelectorAll('img')];

        for (const img of imgs) {
          results.push({
            src: img.src,
            alt: img.alt || '',
            width: img.naturalWidth,
            height: img.naturalHeight,
            articleTop: articleBox.top,
          });
        }
      }

      return results;
    });

    const latest = selectBestArticleImageCandidate(candidates);
    if (!latest) throw new Error('No large Facebook feed image found');

    const response = await page.request.get(latest);
    if (!response.ok()) {
      throw new Error(`Feed image download failed: HTTP ${response.status()}`);
    }

    const mimeType = response.headers()['content-type']?.split(';')[0] || 'image/jpeg';
    const bytes = await response.body();
    if (bytes.length < 1024) throw new Error('Downloaded feed image is too small');
    return { base64: bytes.toString('base64'), mimeType };
  } finally {
    await browser.close();
  }
}

async function extractMenuWithGemini(image: { base64: string; mimeType: string }): Promise<UsotonuMenuPayload> {
  const apiKey = geminiApiKey();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  'Z obrazku denneho menu vytiahni dnesne poledne jedla. Vrat presny JSON s klucmi: soup (string alebo null), extra (string alebo null), items (pole jedal, kazde s name a price). Ceny formatuj ako 180 Kč. Text ponechaj v cestine. Ziadne komentare, len cisty JSON.',
              },
              {
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              soup: { type: 'string', nullable: true },
              extra: { type: 'string', nullable: true },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    price: { type: 'string' },
                  },
                  required: ['name', 'price'],
                },
              },
            },
            required: ['soup', 'items'],
          },
        },
      }),
    },
  );

  if (!res.ok) throw new Error(`Gemini OCR failed: HTTP ${res.status}`);
  return parseGeminiMenuResponse(await res.json());
}

export async function scrapeUsotonuFacebookMenu(): Promise<UsotonuMenuPayload> {
  if (isPragueWeekend()) {
    throw new Error('Vikend - U Sotonu poledni menu nedostupne');
  }
  geminiApiKey();

  let browserError = 'Playwright failed';
  try {
    return await extractMenuWithGemini(await findLatestFeedImageWithPlaywright());
  } catch (playwrightError) {
    // Fall through to static HTML extraction. The caller receives both failure
    // paths if the fallback also cannot produce a valid menu.
    browserError = playwrightError instanceof Error ? playwrightError.message : 'Playwright failed';
  }

  const html = await fetchFacebookPageHtml();
  const candidates = extractFacebookImageCandidates(html);
  if (candidates.length === 0) throw new Error('No Facebook image candidates found');

  const ordered = [
    selectBestFacebookImageCandidate(candidates),
    ...candidates,
  ].filter((url, index, urls): url is string => !!url && urls.indexOf(url) === index);
  const errors: string[] = [];

  for (const url of ordered.slice(0, MAX_GEMINI_ATTEMPTS)) {
    try {
      return await extractMenuWithGemini(await downloadImageAsBase64(url));
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : 'OCR failed'}`);
    }
  }

  throw new Error(
    `U Sotonu OCR failed for all candidates (browser: ${browserError}; html: ${errors.join('; ')})`,
  );
}
