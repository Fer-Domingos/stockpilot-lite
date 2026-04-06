import { NextResponse } from 'next/server';

type ExtractRequestBody = {
  url?: string;
};

function decodePdfLiteral(value: string) {
  return value
    .replace(/\\\\n/g, '\n')
    .replace(/\\\\r/g, '\r')
    .replace(/\\\\t/g, '\t')
    .replace(/\\\\\(/g, '(')
    .replace(/\\\\\)/g, ')')
    .replace(/\\\\\\\\/g, '\\');
}

function extractPdfText(buffer: Buffer) {
  const raw = buffer.toString('latin1');
  const matches = raw.match(/\((?:\\\\.|[^\\)])*\)/g) ?? [];

  const pieces = matches
    .map((entry) => decodePdfLiteral(entry.slice(1, -1)).trim())
    .filter((entry) => entry.length > 1)
    .filter((entry) => /[A-Za-z0-9]/.test(entry));

  return pieces.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExtractRequestBody;
    const sourceUrl = body.url?.trim();

    if (!sourceUrl) {
      return NextResponse.json({ error: 'Invoice URL is required.' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(sourceUrl);
    } catch {
      return NextResponse.json({ error: 'Invoice URL is invalid.' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Invoice URL must be http or https.' }, { status: 400 });
    }

    if (!parsedUrl.pathname.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Text extraction currently supports PDFs only.' }, { status: 400 });
    }

    const fileResponse = await fetch(parsedUrl.toString());
    if (!fileResponse.ok) {
      return NextResponse.json({ error: 'Unable to download the uploaded PDF.' }, { status: 502 });
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    if (!pdfBuffer.toString('latin1', 0, 4).startsWith('%PDF')) {
      return NextResponse.json({ error: 'Uploaded file is not a valid PDF.' }, { status: 400 });
    }

    const text = extractPdfText(pdfBuffer);
    if (!text) {
      return NextResponse.json({ text: '' });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Failed to extract invoice text:', error);
    return NextResponse.json({ error: 'Unable to extract invoice text right now.' }, { status: 500 });
  }
}
