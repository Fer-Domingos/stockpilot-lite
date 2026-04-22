import { NextResponse } from 'next/server';

function extractPdfText(buffer: Buffer) {
  const raw = buffer.toString('latin1');
  const textChunks: string[] = [];
  const operatorPattern = /\(([^)]{1,500})\)\s*T[Jj]/g;
  const arrayOperatorPattern = /\[([^\]]{1,2000})\]\s*TJ/g;

  for (const match of raw.matchAll(operatorPattern)) {
    textChunks.push(match[1]);
  }

  for (const match of raw.matchAll(arrayOperatorPattern)) {
    const nestedPattern = /\(([^)]{1,500})\)/g;
    for (const nested of match[1].matchAll(nestedPattern)) {
      textChunks.push(nested[1]);
    }
  }

  const decoded = textChunks
    .map((entry) => entry.replace(/\\([nrtbf()\\])/g, '$1').replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(Number.parseInt(oct, 8))))
    .join('\n')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return decoded;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFile = formData.get('file');

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 });
    }

    const isPdf = uploadedFile.type === 'application/pdf' || uploadedFile.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 });
    }

    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    const text = extractPdfText(buffer);

    if (!text) {
      return NextResponse.json({ error: 'No text could be extracted from this PDF.' }, { status: 422 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to extract invoice text right now.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
