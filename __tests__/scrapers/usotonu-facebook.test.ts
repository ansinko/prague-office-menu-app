import { describe, expect, it } from 'vitest';
import {
  extractFacebookImageCandidates,
  parseGeminiMenuResponse,
  selectBestArticleImageCandidate,
  selectBestFacebookImageCandidate,
} from '@/lib/scrapers/usotonu-facebook';

describe('extractFacebookImageCandidates', () => {
  it('extracts and deduplicates image URLs from facebook-like HTML', () => {
    const html = `
      <meta property="og:image" content="https://scontent-prg1-1.xx.fbcdn.net/v/t39.30808-6/obedove-menu.jpg?stp=dst-jpg&amp;_nc_cat=1">
      <img src="https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=123&amp;ext=jpg">
      <script>{"url":"https:\\/\\/scontent-prg1-1.xx.fbcdn.net\\/v\\/t39.30808-6\\/denni-menu.jpg?oh=abc\\u0026oe=def"}</script>
      <img src="https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=123&amp;ext=jpg">
    `;

    expect(extractFacebookImageCandidates(html)).toEqual([
      'https://scontent-prg1-1.xx.fbcdn.net/v/t39.30808-6/obedove-menu.jpg?stp=dst-jpg&_nc_cat=1',
      'https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=123&ext=jpg',
      'https://scontent-prg1-1.xx.fbcdn.net/v/t39.30808-6/denni-menu.jpg?oh=abc&oe=def',
    ]);
  });
});

describe('selectBestFacebookImageCandidate', () => {
  it('prefers menu-like image candidates over generic images', () => {
    const selected = selectBestFacebookImageCandidate([
      'https://scontent.xx.fbcdn.net/profile-photo.jpg',
      'https://scontent.xx.fbcdn.net/denni-menu-2026-06-07.jpg',
      'https://example.com/not-facebook.png',
    ]);

    expect(selected).toBe('https://scontent.xx.fbcdn.net/denni-menu-2026-06-07.jpg');
  });

  it('prefers Facebook post photos over profile and static assets', () => {
    const selected = selectBestFacebookImageCandidate([
      'https://scontent.xx.fbcdn.net/v/t39.30808-1/302496403_profile.jpg?ctp=s720x720',
      'https://static.xx.fbcdn.net/rsrc.php/ye/r/949Iq5tt9Te.webp',
      'https://scontent.xx.fbcdn.net/v/t39.30808-6/716030270_post.jpg?ctp=p526x296',
    ]);

    expect(selected).toBe('https://scontent.xx.fbcdn.net/v/t39.30808-6/716030270_post.jpg?ctp=p526x296');
  });
});

describe('selectBestArticleImageCandidate', () => {
  it('picks the first large feed image and skips profile, cover, and small assets', () => {
    const selected = selectBestArticleImageCandidate([
      {
        src: 'https://scontent.xx.fbcdn.net/v/t39.30808-1/profile.jpg',
        alt: 'Profile picture',
        width: 900,
        height: 900,
        articleTop: 10,
      },
      {
        src: 'https://scontent.xx.fbcdn.net/v/t39.30808-6/latest-menu.jpg',
        alt: '',
        width: 526,
        height: 296,
        articleTop: 20,
      },
      {
        src: 'https://scontent.xx.fbcdn.net/v/t39.30808-6/tiny.jpg',
        alt: '',
        width: 120,
        height: 90,
        articleTop: 5,
      },
      {
        src: 'https://scontent.xx.fbcdn.net/v/t39.30808-6/older-menu.jpg',
        alt: '',
        width: 700,
        height: 500,
        articleTop: 100,
      },
    ]);

    expect(selected).toBe('https://scontent.xx.fbcdn.net/v/t39.30808-6/latest-menu.jpg');
  });
});

describe('parseGeminiMenuResponse', () => {
  it('parses a raw JSON string response', () => {
    const parsed = parseGeminiMenuResponse(
      '{"soup":"Kulajda","extra":null,"items":[{"name":"Rizek, brambory","price":"180 Kč"}]}',
    );

    expect(parsed).toEqual({
      soup: 'Kulajda',
      extra: null,
      items: [{ name: 'Rizek, brambory', price: '180 Kč' }],
    });
  });

  it('parses a Gemini generated-content envelope with fenced JSON', () => {
    const parsed = parseGeminiMenuResponse({
      candidates: [
        {
          content: {
            parts: [
              {
                text: '```json\n{"soup":null,"extra":"Salatek","items":[{"name":"Gulas","price":"175 Kč"}]}\n```',
              },
            ],
          },
        },
      ],
    });

    expect(parsed).toEqual({
      soup: null,
      extra: 'Salatek',
      items: [{ name: 'Gulas', price: '175 Kč' }],
    });
  });

  it('rejects invalid or empty menu payloads', () => {
    expect(() => parseGeminiMenuResponse('{"soup":null,"extra":null,"items":[]}')).toThrow(
      /empty menu/i,
    );
    expect(() => parseGeminiMenuResponse('{"soup":null,"items":[{"name":"Gulas"}]}')).toThrow(
      /valid menu items/i,
    );
  });
});
