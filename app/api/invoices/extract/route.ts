import pdf from 'pdf-parse';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function normalizeExtractedText(text: string): string {
  return text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFile = formData.get('file');

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: 'A file upload is required.' }, { status: 400 });
    }

    const isPdf = uploadedFile.type === 'application/pdf' || uploadedFile.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      return NextResponse.json({ error: 'Only PDF files are supported for text extraction.' }, { status: 400 });
    }

    const arrayBuffer = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await pdf(buffer);
    const extractedText = normalizeExtractedText(parsed.text ?? '');

    return NextResponse.json({
      text: extractedText,
      hasText: extractedText.length > 0,
      needsOcr: extractedText.length === 0
    });
  } catch (error) {
    console.error('Failed to extract invoice text from PDF:', error);
    return NextResponse.json({ error: 'Unable to extract text from PDF right now.' }, { status: 500 });
  }
}
