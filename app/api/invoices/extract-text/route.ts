import { NextResponse } from 'next/server';
import zlib from 'node:zlib';

export const runtime = 'nodejs';

type ExtractRequestBody = {
  fileUrl?: string;
  fileName?: string;
};

function normalizeExtractedText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function decodePdfString(value: string) {
  let output = '';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== '\\') {
      output += char;
      continue;
    }

    const next = value[index + 1];
    if (!next) {
      continue;
    }

    if (/[0-7]/.test(next)) {
      const octal = value.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] ?? next;
      output += String.fromCharCode(parseInt(octal, 8));
      index += octal.length;
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
      default:
        output += next;
        break;
    }

    index += 1;
  }

  return output;
}

function extractTextFromPdfBuffer(buffer: Buffer) {
  const pdfBinary = buffer.toString('latin1');
  const streamMatcher = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const chunks: string[] = [];
  let streamMatch: RegExpExecArray | null;

  while ((streamMatch = streamMatcher.exec(pdfBinary)) !== null) {
    const streamData = Buffer.from(streamMatch[1], 'latin1');
    let decoded = streamData;

    try {
      decoded = zlib.inflateSync(streamData);
    } catch {
      // Not compressed with FlateDecode; keep original stream bytes.
    }

    chunks.push(decoded.toString('latin1'));
  }

  const textSegments: string[] = [];
  const textCommandMatcher = /\((?:\\.|[^\\)])*\)\s*Tj|\[(?:\s*(?:\((?:\\.|[^\\)])*\)|<[^>]*>|-?\d+(?:\.\d+)?)\s*)+\]\s*TJ/g;

  for (const chunk of chunks) {
    const textBlockMatcher = /BT([\s\S]*?)ET/g;
    let blockMatch: RegExpExecArray | null;

    while ((blockMatch = textBlockMatcher.exec(chunk)) !== null) {
      const block = blockMatch[1];
      let commandMatch: RegExpExecArray | null;

      while ((commandMatch = textCommandMatcher.exec(block)) !== null) {
        const command = commandMatch[0];
        const strings = [...command.matchAll(/\((?:\\.|[^\\)])*\)/g)].map((entry) => entry[0].slice(1, -1));
        if (strings.length > 0) {
          textSegments.push(strings.map((entry) => decodePdfString(entry)).join(''));
        }
      }
    }
  }

  return normalizeExtractedText(textSegments.join('\n'));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExtractRequestBody;
    if (!body.fileUrl) {
      return NextResponse.json({ error: 'Missing file URL for extraction.' }, { status: 400 });
    }

    const fileResponse = await fetch(body.fileUrl);
    if (!fileResponse.ok) {
      console.error('Invoice extract fetch failed', {
        status: fileResponse.status,
        fileName: body.fileName ?? 'unknown'
      });
      return NextResponse.json({ error: 'Unable to download uploaded file for extraction.' }, { status: 400 });
    }

    const contentType = fileResponse.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('pdf')) {
      return NextResponse.json(
        { error: 'Text extraction currently supports PDF files only. Please upload a PDF.' },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
    const extractedText = extractTextFromPdfBuffer(fileBuffer);

    if (!extractedText) {
      console.error('Invoice extract produced empty text', { fileName: body.fileName ?? 'unknown' });
      return NextResponse.json(
        { error: 'No readable text found in this PDF. It may be image-only or protected.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: extractedText });
  } catch (error) {
    console.error('Invoice extract failed', error);
    return NextResponse.json({ error: 'Unable to extract invoice text right now.' }, { status: 500 });
  }
}
