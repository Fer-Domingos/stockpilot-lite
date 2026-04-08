import zlib from 'node:zlib';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function decodePdfLiteralString(value: string) {
  let decoded = '';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char !== '\\') {
      decoded += char;
      continue;
    }

    const next = value[index + 1];
    if (!next) {
      break;
    }

    if (next === 'n') {
      decoded += '\n';
      index += 1;
      continue;
    }

    if (next === 'r') {
      decoded += '\r';
      index += 1;
      continue;
    }

    if (next === 't') {
      decoded += '\t';
      index += 1;
      continue;
    }

    if (next === 'b') {
      decoded += '\b';
      index += 1;
      continue;
    }

    if (next === 'f') {
      decoded += '\f';
      index += 1;
      continue;
    }

    if (/[0-7]/.test(next)) {
      const octal = value.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] ?? next;
      decoded += String.fromCharCode(Number.parseInt(octal, 8));
      index += octal.length;
      continue;
    }

    decoded += next;
    index += 1;
  }

  return decoded;
}

function decodePdfHexString(hexValue: string) {
  const compact = hexValue.replace(/\s+/g, '');
  const padded = compact.length % 2 === 0 ? compact : `${compact}0`;

  try {
    return Buffer.from(padded, 'hex').toString('utf8');
  } catch {
    return '';
  }
}

function extractTextFromChunk(chunk: string) {
  const pieces: string[] = [];
  const tjRegex = /\((?:\\.|[^\\)])*\)\s*Tj\b/g;
  const hexTjRegex = /<([0-9A-Fa-f\s]+)>\s*Tj\b/g;
  const tjArrayRegex = /\[((?:.|\n|\r)*?)\]\s*TJ\b/g;

  for (const match of chunk.matchAll(tjRegex)) {
    const content = match[0].replace(/\)\s*Tj\b$/, '').slice(1);
    const decoded = decodePdfLiteralString(content);
    if (decoded.trim()) {
      pieces.push(decoded);
    }
  }

  for (const match of chunk.matchAll(hexTjRegex)) {
    const decoded = decodePdfHexString(match[1]);
    if (decoded.trim()) {
      pieces.push(decoded);
    }
  }

  for (const match of chunk.matchAll(tjArrayRegex)) {
    const arrayBody = match[1];
    for (const literal of arrayBody.matchAll(/\((?:\\.|[^\\)])*\)/g)) {
      const decoded = decodePdfLiteralString(literal[0].slice(1, -1));
      if (decoded.trim()) {
        pieces.push(decoded);
      }
    }

    for (const hex of arrayBody.matchAll(/<([0-9A-Fa-f\s]+)>/g)) {
      const decoded = decodePdfHexString(hex[1]);
      if (decoded.trim()) {
        pieces.push(decoded);
      }
    }
  }

  return pieces.join(' ').replace(/\s+/g, ' ').trim();
}

function maybeInflateStream(streamData: Buffer, dictPrefix: string) {
  const hasFlateDecode = /\/Filter\s*(?:\[\s*)?\/FlateDecode\b/.test(dictPrefix);
  if (!hasFlateDecode) {
    return streamData;
  }

  try {
    return zlib.inflateSync(streamData);
  } catch {
    try {
      return zlib.inflateRawSync(streamData);
    } catch {
      return Buffer.alloc(0);
    }
  }
}

function extractPdfText(buffer: Buffer) {
  const raw = buffer.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const collected: string[] = [];

  for (const match of raw.matchAll(streamRegex)) {
    const streamContent = match[1];
    const streamIndex = match.index ?? 0;
    const dictPrefix = raw.slice(Math.max(0, streamIndex - 240), streamIndex + 40);
    const streamBuffer = Buffer.from(streamContent, 'latin1');
    const inflated = maybeInflateStream(streamBuffer, dictPrefix);

    const directText = extractTextFromChunk(streamBuffer.toString('latin1'));
    if (directText) {
      collected.push(directText);
    }

    if (inflated.length > 0) {
      const inflatedText = extractTextFromChunk(inflated.toString('latin1'));
      if (inflatedText) {
        collected.push(inflatedText);
      }
    }
  }

  return collected.join('\n').replace(/\u0000/g, '').trim();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFile = formData.get('file');

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 });
    }

    const isPdfType = uploadedFile.type === 'application/pdf' || uploadedFile.name.toLowerCase().endsWith('.pdf');
    if (!isPdfType) {
      return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 });
    }

    const arrayBuffer = await uploadedFile.arrayBuffer();
    const text = extractPdfText(Buffer.from(arrayBuffer));

    if (text.trim().length < 10) {
      return NextResponse.json({ error: 'No text could be extracted from this PDF.' }, { status: 400 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Failed to extract invoice PDF text:', error);
    return NextResponse.json({ error: 'Unable to extract text from this PDF.' }, { status: 500 });
  }
}
