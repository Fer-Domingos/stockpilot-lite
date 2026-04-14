import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type ExtractedLine = {
  qty: string;
  code: string;
  description: string;
};

const ignoredTokens = ['HANDLING CHARGE', 'TAX', 'FREIGHT', 'DELIVERY', 'SUBTOTAL', 'TOTAL'];

function cleanLine(line: string) {
  return line.replace(/\s+/g, ' ').trim();
}

function looksIgnored(line: string) {
  const upper = line.toUpperCase();
  return ignoredTokens.some((token) => upper.includes(token));
}

function decodePdfString(value: string) {
  return value
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\([0-7]{3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}

function extractTextFromPdfBuffer(buffer: Buffer) {
  const content = buffer.toString('latin1');
  const textChunks: string[] = [];

  const blockPattern = /(stream\r?\n)([\s\S]*?)(\r?\nendstream)/g;
  for (const block of content.matchAll(blockPattern)) {
    const streamBody = block[2];
    const textPattern = /\(([^()]*(?:\\.[^()]*)*)\)\s*Tj|\[(.*?)\]\s*TJ/g;

    for (const item of streamBody.matchAll(textPattern)) {
      if (item[1]) {
        textChunks.push(decodePdfString(item[1]));
      }

      if (item[2]) {
        const nested = [...item[2].matchAll(/\(([^()]*(?:\\.[^()]*)*)\)/g)].map((entry) => decodePdfString(entry[1]));
        if (nested.length > 0) {
          textChunks.push(nested.join(''));
        }
      }
    }
  }

  return textChunks
    .join('\n')
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .filter(Boolean)
    .join('\n');
}

function extractInvoiceReference(text: string) {
  const candidates = [
    /\bINVOICE\s*(?:#|NO\.?|NUMBER)?\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
    /\bREF(?:ERENCE)?\s*(?:#|NO\.?|NUMBER)?\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
    /\bPO\s*(?:#|NO\.?|NUMBER)?\s*[:\-]?\s*([A-Z0-9\-\/]+)/i
  ];

  for (const pattern of candidates) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return '';
}

function extractVendor(lines: string[]) {
  const preferred = lines.find((line) => /\bROYAL\b/i.test(line));
  if (preferred) {
    return preferred;
  }

  const generic = lines.find(
    (line) =>
      line.length > 3 &&
      line.length < 80 &&
      !/invoice|bill to|ship to|date|page|order/i.test(line) &&
      /^[A-Za-z0-9 .&'\-]+$/.test(line)
  );

  return generic ?? '';
}

function extractStockLines(lines: string[]): ExtractedLine[] {
  const seen = new Set<string>();
  const parsed: ExtractedLine[] = [];

  for (const sourceLine of lines) {
    const line = cleanLine(sourceLine);

    if (!line || looksIgnored(line)) {
      continue;
    }

    const match = line.match(/^(\d{1,6})\s+([A-Z0-9"'\-./]{3,})\s+(.+)$/i);
    if (!match) {
      continue;
    }

    const [, qty, code, description] = match;
    const cleanedDescription = description.trim();

    if (!cleanedDescription || looksIgnored(cleanedDescription)) {
      continue;
    }

    const key = `${qty}|${code}|${cleanedDescription}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    parsed.push({ qty, code, description: cleanedDescription });
  }

  return parsed;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { url?: string };
    const fileUrl = payload.url?.trim();

    if (!fileUrl) {
      return NextResponse.json({ error: 'Uploaded invoice URL is required.' }, { status: 400 });
    }

    const parsedUrl = new URL(fileUrl);
    const isPdf = parsedUrl.pathname.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      return NextResponse.json({ error: 'Only PDF text extraction is supported.' }, { status: 400 });
    }

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return NextResponse.json({ error: 'Unable to download uploaded invoice.' }, { status: 400 });
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    const rawText = extractTextFromPdfBuffer(buffer);

    if (!rawText.trim()) {
      return NextResponse.json({ error: 'No readable text was found in the uploaded PDF.' }, { status: 400 });
    }

    const lines = rawText
      .split(/\r?\n/)
      .map((line) => cleanLine(line))
      .filter(Boolean);

    return NextResponse.json({
      rawText,
      vendor: extractVendor(lines),
      invoiceRef: extractInvoiceReference(rawText),
      lines: extractStockLines(lines)
    });
  } catch (error) {
    console.error('Failed to extract invoice text:', error);
    return NextResponse.json({ error: 'Unable to process uploaded invoice text right now.' }, { status: 500 });
  }
}
