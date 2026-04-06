import { inflateSync } from 'node:zlib';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ignoredRowPattern = /(handling\s*charge|sales\s*tax|subtotal|sub\s*total|total\s+due|balance\s+due|amount\s+due|total\b)/i;

function extractPdfStreams(pdfBuffer: Buffer) {
  const streams: Buffer[] = [];
  const streamToken = Buffer.from('stream');
  const endStreamToken = Buffer.from('endstream');

  let cursor = 0;

  while (cursor < pdfBuffer.length) {
    const streamIndex = pdfBuffer.indexOf(streamToken, cursor);
    if (streamIndex === -1) {
      break;
    }

    let dataStart = streamIndex + streamToken.length;
    if (pdfBuffer[dataStart] === 0x0d && pdfBuffer[dataStart + 1] === 0x0a) {
      dataStart += 2;
    } else if (pdfBuffer[dataStart] === 0x0a || pdfBuffer[dataStart] === 0x0d) {
      dataStart += 1;
    }

    const endStreamIndex = pdfBuffer.indexOf(endStreamToken, dataStart);
    if (endStreamIndex === -1) {
      break;
    }

    const dictionaryStart = pdfBuffer.lastIndexOf(Buffer.from('<<'), streamIndex);
    const dictionaryEnd = dictionaryStart === -1 ? -1 : pdfBuffer.indexOf(Buffer.from('>>'), dictionaryStart);
    const dictionary =
      dictionaryStart !== -1 && dictionaryEnd !== -1 && dictionaryEnd < streamIndex
        ? pdfBuffer.subarray(dictionaryStart, dictionaryEnd + 2).toString('latin1')
        : '';

    const rawStream = pdfBuffer.subarray(dataStart, endStreamIndex);

    if (/\/FlateDecode/i.test(dictionary)) {
      try {
        streams.push(inflateSync(rawStream));
      } catch {
        streams.push(rawStream);
      }
    } else {
      streams.push(rawStream);
    }

    cursor = endStreamIndex + endStreamToken.length;
  }

  return streams;
}

function decodePdfLiteralString(literal: string) {
  let output = '';

  for (let index = 0; index < literal.length; index += 1) {
    const char = literal[index];

    if (char !== '\\') {
      output += char;
      continue;
    }

    const next = literal[index + 1] ?? '';

    if (next === 'n') {
      output += '\n';
      index += 1;
      continue;
    }
    if (next === 'r') {
      output += '\r';
      index += 1;
      continue;
    }
    if (next === 't') {
      output += '\t';
      index += 1;
      continue;
    }
    if (next === 'b') {
      output += '\b';
      index += 1;
      continue;
    }
    if (next === 'f') {
      output += '\f';
      index += 1;
      continue;
    }
    if (next === '\\' || next === '(' || next === ')') {
      output += next;
      index += 1;
      continue;
    }

    if (/[0-7]/.test(next)) {
      const octal = (literal.slice(index + 1).match(/^[0-7]{1,3}/) ?? [''])[0];
      if (octal) {
        output += String.fromCharCode(Number.parseInt(octal, 8));
        index += octal.length;
        continue;
      }
    }

    output += next;
    index += 1;
  }

  return output;
}

function decodePdfHexString(hex: string) {
  const normalized = hex.replace(/\s+/g, '');
  const safeHex = normalized.length % 2 === 0 ? normalized : `${normalized}0`;
  return Buffer.from(safeHex, 'hex').toString('latin1');
}

function extractTextFromContentStream(content: string) {
  const textBlocks = content.match(/BT[\s\S]*?ET/g) ?? [];

  const lines: string[] = [];

  for (const block of textBlocks) {
    const fragments: string[] = [];

    const literalMatches = block.match(/\((?:\\.|[^\\)])*\)\s*Tj/g) ?? [];
    for (const match of literalMatches) {
      const literal = match.replace(/\s*Tj$/, '').trim();
      const inner = literal.slice(1, -1);
      fragments.push(decodePdfLiteralString(inner));
    }

    const tjArrayMatches = block.match(/\[[\s\S]*?\]\s*TJ/g) ?? [];
    for (const match of tjArrayMatches) {
      const arrayBody = match.replace(/\s*TJ$/, '').trim().slice(1, -1);
      const tokens = arrayBody.match(/\((?:\\.|[^\\)])*\)|<[^>]*>/g) ?? [];
      for (const token of tokens) {
        if (token.startsWith('(')) {
          fragments.push(decodePdfLiteralString(token.slice(1, -1)));
        } else {
          fragments.push(decodePdfHexString(token.slice(1, -1)));
        }
      }
    }

    if (fragments.length > 0) {
      lines.push(fragments.join(' '));
    }
  }

  return lines;
}

function normalizeLine(line: string) {
  return line
    .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCleanInvoiceText(lines: string[]) {
  const normalizedLines = lines
    .map(normalizeLine)
    .filter(Boolean)
    .filter((line) => !ignoredRowPattern.test(line));

  const dedupedLines: string[] = [];
  for (const line of normalizedLines) {
    if (dedupedLines[dedupedLines.length - 1] !== line) {
      dedupedLines.push(line);
    }
  }

  return dedupedLines.join('\n');
}

async function readPdfBytesFromRequest(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');

    const isFileLike =
      file !== null && typeof file === 'object' && 'arrayBuffer' in file && 'type' in file && 'size' in file;

    if (!isFileLike || file.size <= 0) {
      throw new Error('A PDF file upload is required.');
    }

    if (!String(file.type).includes('pdf')) {
      throw new Error('Only PDF extraction is supported right now.');
    }

    return Buffer.from(await file.arrayBuffer());
  }

  const body = (await request.json().catch(() => null)) as
    | {
        url?: string;
        fileUrl?: string;
        blobUrl?: string;
      }
    | null;

  const sourceUrl = body?.url ?? body?.fileUrl ?? body?.blobUrl;

  if (!sourceUrl) {
    throw new Error('A PDF file URL is required.');
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error('Unable to download uploaded PDF.');
  }

  const pdfBytes = Buffer.from(await response.arrayBuffer());
  return pdfBytes;
}

export async function POST(request: Request) {
  try {
    const pdfBuffer = await readPdfBytesFromRequest(request);

    if (pdfBuffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return NextResponse.json({ error: 'Uploaded file is not a valid PDF.' }, { status: 400 });
    }

    const streams = extractPdfStreams(pdfBuffer);
    const rawLines = streams
      .map((stream) => stream.toString('latin1'))
      .flatMap((content) => extractTextFromContentStream(content));

    const text = buildCleanInvoiceText(rawLines);

    if (!text) {
      return NextResponse.json(
        {
          error: 'No readable text found in PDF. OCR is not enabled yet for scanned image invoices.'
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Failed to extract invoice text:', error);

    const message = error instanceof Error ? error.message : 'Unable to extract invoice text.';
    const status =
      message.includes('required') || message.includes('supported') || message.includes('valid PDF') ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
