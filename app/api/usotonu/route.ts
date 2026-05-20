import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-api-key');
  if (secret !== process.env.USOTONU_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = await req.json();
  const body = {
    ...raw,
    soup: raw.soup === 'null' || !raw.soup ? null : raw.soup,
    extra: raw.extra === 'null' || !raw.extra ? null : raw.extra,
  };
  const blob = await put('usotonu.json', JSON.stringify(body), {
    access: 'public',
    allowOverwrite: true,
    contentType: 'application/json',
  });

  return NextResponse.json({ url: blob.url });
}
