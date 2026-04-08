import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const noTextErrorMessage = 'No text could be extracted from this PDF.';

function decodePdfLiteralString(value: string) {
  return value
    .replace(/^\(/, '')
    .replace(/\)$/, '')
    .replace(/\\([nrtbf()\\])/g, (_match, escaped: string) => {
      switch (escaped) {
        case 'n':
          return '\n';
        case 'r':
          return '\r';
        case 't':
          return '\t';
        case 'b':
          return '\b';
        case 'f':
          return '\f';
        default:
          return escaped;
      }
    })
    .replace(/\\\d{1,3}/g, (octal) => String.fromCharCode(Number.parseInt(octal.slice(1), 8)));
}

function decodePdfHexString(value: string) {
  const rawHex = value.slice(1, -1).replace(/\s+/g, '');
  if (!rawHex) {
    return '';
  }

  const paddedHex = rawHex.length % 2 === 0 ? rawHex : `${rawHex}0`;
  const chars: string[] = [];

  for (let index = 0; index < paddedHex.length; index += 2) {
    const byte = Number.parseInt(paddedHex.slice(index, index + 2), 16);
    if (Number.isNaN(byte)) {
      continue;
    }
    chars.push(String.fromCharCode(byte));
  }

  return chars.join('');
}

function extractTextFromPdfBytes(pdfBytes: Uint8Array) {
  const content = Buffer.from(pdfBytes).toString('latin1');
  const literalMatches = content.match(/\((?:\\.|[^\\)])*\)/g) ?? [];
  const hexMatches = content.match(/<[0-9A-Fa-f\s]+>/g) ?? [];

  const joined = [...literalMatches.map(decodePdfLiteralString), ...hexMatches.map(decodePdfHexString)].join('\n');

  return joined.replace(/\s+/g, ' ').trim();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFile = formData.get('file');

    const isFileLike =
      uploadedFile !== null &&
      typeof uploadedFile === 'object' &&
      'size' in uploadedFile &&
      'name' in uploadedFile &&
      'type' in uploadedFile;

    if (!isFileLike || uploadedFile.type !== 'application/pdf' || uploadedFile.size <= 0) {
      return NextResponse.json({ error: noTextErrorMessage }, { status: 400 });
    }

    const pdfBytes = new Uint8Array(await uploadedFile.arrayBuffer());
    const text = extractTextFromPdfBytes(pdfBytes);

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ error: noTextErrorMessage }, { status: 400 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Failed to extract text from PDF:', error);
    return NextResponse.json({ error: noTextErrorMessage }, { status: 400 });
  }
}
