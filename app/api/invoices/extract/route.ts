import { NextResponse } from 'next/server';

import { extractInvoiceTextFromBuffer } from '@/lib/invoice-text-extraction';

export const runtime = 'nodejs';

const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function parseMimeType(contentType: string | null) {
  if (!contentType) {
    return null;
  }

  return contentType.split(';')[0]?.trim().toLowerCase() ?? null;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { url?: string };

    if (!payload?.url || typeof payload.url !== 'string') {
      return NextResponse.json({ error: 'Invoice file URL is required.' }, { status: 400 });
    }

    const fileResponse = await fetch(payload.url);
    if (!fileResponse.ok) {
      return NextResponse.json({ error: 'Unable to download invoice file.' }, { status: 400 });
    }

    const mimeType = parseMimeType(fileResponse.headers.get('content-type'));
    if (!mimeType || !allowedMimeTypes.has(mimeType)) {
      return NextResponse.json({ error: 'Unsupported invoice file format.' }, { status: 400 });
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    const extraction = await extractInvoiceTextFromBuffer(buffer, mimeType);

    return NextResponse.json({
      text: extraction.text,
      strategy: extraction.strategy
    });
  } catch (error) {
    console.error('Failed to extract invoice text:', error);
    return NextResponse.json({ error: 'Unable to extract invoice text right now.' }, { status: 500 });
  }
}
