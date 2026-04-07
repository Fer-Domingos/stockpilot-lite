import { NextResponse } from 'next/server';
import { inflateSync } from 'zlib';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const OCR_REQUIRED_ERROR = 'This PDF needs OCR or manual review';

function decodePdfLiteralString(value: string): string {
  const trimmed = value.startsWith('(') && value.endsWith(')') ? value.slice(1, -1) : value;
  let output = '';

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (char !== '\\') {
      output += char;
      continue;
    }

    const next = trimmed[index + 1];

    if (!next) {
      break;
    }

    if (/[0-7]/.test(next)) {
      const octalDigits = trimmed.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] ?? '';
      output += String.fromCharCode(parseInt(octalDigits, 8));
      index += octalDigits.length;
      continue;
    }

    switch (next) {
      case 'n':
        output += '\n';
        break;
      case 'r':
        output += '\r';
        break;
      case 't':
        output += '\t';
        break;
      case 'b':
        output += '\b';
        break;
      case 'f':
        output += '\f';
        break;
      case '(':
      case ')':
      case '\\':
        output += next;
        break;
      case '\n':
      case '\r':
        break;
      default:
        output += next;
        break;
    }

    index += 1;
  }

  return output;
}

function decodePdfHexString(value: string): string {
  const cleanedHex = value
    .replace(/^</, '')
    .replace(/>$/, '')
    .replace(/\s+/g, '');

  if (!cleanedHex) {
    return '';
  }

  const normalizedHex = cleanedHex.length % 2 === 0 ? cleanedHex : `${cleanedHex}0`;
  const bytes = Buffer.from(normalizedHex, 'hex');
  return bytes.toString('utf8');
}

function extractTextCandidates(content: string): string[] {
  const candidates: string[] = [];
  const textTokenPattern = /\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>/g;

  for (const match of content.matchAll(textTokenPattern)) {
    const token = match[0];

    if (token.startsWith('(')) {
      candidates.push(decodePdfLiteralString(token));
      continue;
    }

    if (token.startsWith('<') && token.endsWith('>')) {
      candidates.push(decodePdfHexString(token));
    }
  }

  return candidates;
}

function inflatePdfStream(streamBuffer: Buffer, dictionaryText: string): string {
  const usesFlateDecode = /\/Filter\s*\[?\s*\/FlateDecode\b/.test(dictionaryText);

  if (usesFlateDecode) {
    try {
      return inflateSync(streamBuffer).toString('latin1');
    } catch {
      return '';
    }
  }

  return streamBuffer.toString('latin1');
}

function extractTextFromPdfBuffer(buffer: Buffer): string {
  const source = buffer.toString('latin1');
  const extractedSegments: string[] = [];

  let cursor = 0;
  while (cursor < source.length) {
    const streamIndex = source.indexOf('stream', cursor);

    if (streamIndex === -1) {
      break;
    }

    const afterStream = streamIndex + 'stream'.length;
    const streamStart = source.startsWith('\r\n', afterStream)
      ? afterStream + 2
      : source[afterStream] === '\n'
        ? afterStream + 1
        : afterStream;

    const endStreamIndex = source.indexOf('endstream', streamStart);
    if (endStreamIndex === -1) {
      break;
    }

    const dictionaryStart = source.lastIndexOf('<<', streamIndex);
    const dictionaryEnd = source.indexOf('>>', dictionaryStart);
    const dictionaryText =
      dictionaryStart !== -1 && dictionaryEnd !== -1 && dictionaryEnd < streamIndex
        ? source.slice(dictionaryStart, dictionaryEnd + 2)
        : '';

    const streamBuffer = buffer.subarray(streamStart, endStreamIndex);
    const inflatedContent = inflatePdfStream(streamBuffer, dictionaryText);
    if (inflatedContent) {
      extractedSegments.push(...extractTextCandidates(inflatedContent));
    }

    cursor = endStreamIndex + 'endstream'.length;
  }

  return extractedSegments
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasReadableText(text: string): boolean {
  const compactText = text.replace(/\s+/g, ' ').trim();
  if (compactText.length < 40) {
    return false;
  }

  const letterCount = (compactText.match(/[A-Za-z]/g) ?? []).length;
  const printableCount = (compactText.match(/[\x20-\x7E]/g) ?? []).length;

  return letterCount >= 15 && printableCount / compactText.length >= 0.65;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFile = formData.get('file');

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: 'Please provide a PDF file.' }, { status: 400 });
    }

    if (uploadedFile.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported for text extraction.' }, { status: 400 });
    }

    if (uploadedFile.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'PDF file must be 10MB or smaller.' }, { status: 400 });
    }

    const pdfBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const extractedText = extractTextFromPdfBuffer(pdfBuffer);

    if (!hasReadableText(extractedText)) {
      return NextResponse.json({ error: OCR_REQUIRED_ERROR }, { status: 422 });
    }

    return NextResponse.json({ text: extractedText });
  } catch (error) {
    console.error('Failed to extract PDF text:', error);
    return NextResponse.json({ error: 'Unable to extract text from this PDF right now.' }, { status: 500 });
  }
}
