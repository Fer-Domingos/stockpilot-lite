import pdfParse from 'pdf-parse';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MIN_EXTRACTED_TEXT_LENGTH = 20;

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

    const pdfBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const parsedPdf = await pdfParse(pdfBuffer);
    const text = parsedPdf.text?.trim() ?? '';

    if (text.length < MIN_EXTRACTED_TEXT_LENGTH) {
      return NextResponse.json({ error: 'No text could be extracted from this PDF.' });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Failed to extract text from PDF:', error);
    return NextResponse.json({ error: 'Unable to extract text from this PDF right now.' }, { status: 500 });
  }
}
