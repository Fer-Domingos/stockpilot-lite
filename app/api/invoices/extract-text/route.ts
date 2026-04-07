import pdf from 'pdf-parse';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const maxFileSizeBytes = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const fileUrl = typeof body?.url === 'string' ? body.url.trim() : '';

    if (!fileUrl) {
      return NextResponse.json({ error: 'Invoice PDF URL is required.' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      return NextResponse.json({ error: 'Invoice PDF URL is invalid.' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP(S) invoice PDF URLs are supported.' }, { status: 400 });
    }

    const response = await fetch(parsedUrl.toString(), { cache: 'no-store' });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Unable to fetch invoice PDF (status ${response.status}).` },
        { status: 400 }
      );
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const bytes = Number.parseInt(contentLength, 10);
      if (!Number.isNaN(bytes) && bytes > maxFileSizeBytes) {
        return NextResponse.json({ error: 'File size exceeds the 10MB limit.' }, { status: 400 });
      }
    }

    const mimeType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (mimeType && !mimeType.includes('application/pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length <= 0) {
      return NextResponse.json({ error: 'Fetched PDF is empty.' }, { status: 400 });
    }

    if (buffer.length > maxFileSizeBytes) {
      return NextResponse.json({ error: 'File size exceeds the 10MB limit.' }, { status: 400 });
    }

    const data = await pdf(buffer);
    const extractedText = data.text;

    if (!extractedText?.trim()) {
      return NextResponse.json({ error: 'This PDF is scanned or unreadable' }, { status: 422 });
    }

    return NextResponse.json({ text: extractedText });
  } catch (error) {
    console.error('Failed to extract invoice PDF text:', error);
    return NextResponse.json({ error: 'Unable to extract text from invoice PDF right now.' }, { status: 500 });
  }
}
