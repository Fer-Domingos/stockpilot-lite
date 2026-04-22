import { NextResponse } from 'next/server';

const maxExtractChars = 20000;

function cleanupExtractedText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractPdfStrings(binary: string) {
  const matches = binary.match(/\(([^()]*)\)/g) ?? [];
  const snippets = matches
    .slice(0, 20000)
    .map((entry) => entry.slice(1, -1))
    .map((entry) => entry.replace(/\\([nrtbf()\\])/g, '$1'))
    .map((entry) => entry.replace(/\\\d{3}/g, ' '))
    .join('\n');

  return cleanupExtractedText(snippets);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { url?: string };
    const invoiceUrl = String(payload.url ?? '').trim();

    if (!invoiceUrl) {
      return NextResponse.json({ error: 'Invoice URL is required.' }, { status: 400 });
    }

    const invoiceResponse = await fetch(invoiceUrl);
    if (!invoiceResponse.ok) {
      return NextResponse.json({ error: 'Unable to download invoice file for text extraction.' }, { status: 502 });
    }

    const contentType = (invoiceResponse.headers.get('content-type') ?? '').toLowerCase();

    let extractedText = '';

    if (contentType.includes('text/plain')) {
      extractedText = cleanupExtractedText(await invoiceResponse.text());
    } else {
      const arrayBuffer = await invoiceResponse.arrayBuffer();
      const binary = Buffer.from(arrayBuffer).toString('latin1');

      if (contentType.includes('application/pdf')) {
        extractedText = extractPdfStrings(binary);
      } else {
        extractedText = '';
      }
    }

    if (!extractedText) {
      return NextResponse.json(
        {
          error:
            'Automatic text extraction could not read this invoice file. You can still use manual Extract or paste invoice text.'
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: extractedText.slice(0, maxExtractChars) });
  } catch (error) {
    console.error('Failed to extract invoice text:', error);
    return NextResponse.json({ error: 'Unable to extract invoice text right now.' }, { status: 500 });
  }
}
