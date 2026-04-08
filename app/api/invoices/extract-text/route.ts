import { inflateSync } from 'node:zlib';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const maxFileSizeBytes = 10 * 1024 * 1024;
const scannedPdfError = 'No text could be extracted from this PDF.';

function decodePdfTextValue(raw: string) {
  return raw
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\([0-7]{3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}

function extractTextOperators(content: string) {
  const matches = content.match(/\((?:\\.|[^\\)])*\)\s*Tj|\[(?:.|\n|\r)*?\]\s*TJ/g) ?? [];
  const chunks: string[] = [];

  for (const match of matches) {
    if (match.endsWith('Tj')) {
      const value = match.replace(/\s*Tj$/, '').trim();
      chunks.push(decodePdfTextValue(value.slice(1, -1)));
      continue;
    }

    const arrayParts = match.match(/\((?:\\.|[^\\)])*\)/g) ?? [];
    const text = arrayParts.map((part) => decodePdfTextValue(part.slice(1, -1))).join(' ');
    if (text.trim()) {
      chunks.push(text);
    }
  }

  return chunks.join('\n');
}

function extractTextFromPdfBuffer(buffer: Buffer) {
  const source = buffer.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const extractedChunks: string[] = [];
  let streamMatch: RegExpExecArray | null;

  while ((streamMatch = streamRegex.exec(source)) !== null) {
    const rawContent = streamMatch[1];
    if (!rawContent) {
      continue;
    }

    const streamStart = streamMatch.index;
    const dictionaryWindow = source.slice(Math.max(0, streamStart - 500), streamStart);
    const hasFlate = /\/Filter\s*\/FlateDecode/.test(dictionaryWindow);

    let decodedContent = rawContent;

    if (hasFlate) {
      try {
        const rawBuffer = Buffer.from(rawContent, 'latin1');
        decodedContent = inflateSync(rawBuffer).toString('latin1');
      } catch {
        continue;
      }
    }

    const extractedText = extractTextOperators(decodedContent).trim();
    if (extractedText) {
      extractedChunks.push(extractedText);
    }
  }

  return extractedChunks.join('\n').replace(/\s{2,}/g, ' ').trim();
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
      'type' in uploadedFile &&
      'arrayBuffer' in uploadedFile;

    if (!isFileLike) {
      return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 });
    }

    if (uploadedFile.size <= 0) {
      return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 });
    }

    if (uploadedFile.size > maxFileSizeBytes) {
      return NextResponse.json({ error: 'File size exceeds the 10MB limit.' }, { status: 400 });
    }

    if (uploadedFile.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed.' }, { status: 400 });
    }

    const pdfBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const extractedText = extractTextFromPdfBuffer(pdfBuffer);

    if (!extractedText) {
      return NextResponse.json({ error: scannedPdfError }, { status: 422 });
    }

    return NextResponse.json({ text: extractedText });
  } catch (error) {
    console.error('Failed to extract PDF text:', error);
    return NextResponse.json({ error: 'Unable to extract text right now.' }, { status: 500 });
  }
}
