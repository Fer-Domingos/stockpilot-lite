import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const maxFileSizeBytes = 10 * 1024 * 1024;
const scannedPdfMessage =
  'This PDF appears to be scanned (image-based). Please paste the invoice text manually or upload a text-based PDF.';

function decodePdfString(value: string) {
  return value
    .replace(/\\\\n/g, '\n')
    .replace(/\\\\r/g, '\r')
    .replace(/\\\\t/g, '\t')
    .replace(/\\\\\\(/g, '(')
    .replace(/\\\\\\)/g, ')')
    .replace(/\\\\\\\\/g, '\\\\');
}

function extractTextFromPdf(rawPdf: string) {
  const parts: string[] = [];

  for (const match of rawPdf.matchAll(/\(([^()]*)\)\s*Tj/g)) {
    const text = decodePdfString(match[1]).trim();
    if (text) {
      parts.push(text);
    }
  }

  for (const match of rawPdf.matchAll(/\[(.*?)\]\s*TJ/gs)) {
    const chunk = match[1];
    const strings = Array.from(chunk.matchAll(/\(([^()]*)\)/g))
      .map((entry) => decodePdfString(entry[1]).trim())
      .filter(Boolean);

    if (strings.length > 0) {
      parts.push(strings.join(' '));
    }
  }

  return parts
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
      return NextResponse.json({ error: 'A PDF file upload is required.' }, { status: 400 });
    }

    if (uploadedFile.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 });
    }

    if (uploadedFile.size <= 0) {
      return NextResponse.json({ error: 'Uploaded PDF is empty.' }, { status: 400 });
    }

    if (uploadedFile.size > maxFileSizeBytes) {
      return NextResponse.json({ error: 'File size exceeds the 10MB limit.' }, { status: 400 });
    }

    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    const rawPdf = buffer.toString('latin1');
    const text = extractTextFromPdf(rawPdf);

    if (!text) {
      return NextResponse.json({ error: scannedPdfMessage }, { status: 422 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Failed to extract invoice text:', error);
    return NextResponse.json({ error: scannedPdfMessage }, { status: 422 });
  }
}
