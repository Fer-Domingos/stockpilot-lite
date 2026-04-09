import pdfParse from 'pdf-parse';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const minimumExtractedTextLength = 10;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFile = formData.get('file');

    const isFileLike =
      uploadedFile !== null &&
      typeof uploadedFile === 'object' &&
      'arrayBuffer' in uploadedFile &&
      'size' in uploadedFile &&
      'type' in uploadedFile;

    if (!isFileLike || uploadedFile.type !== 'application/pdf') {
      return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 });
    }

    if (uploadedFile.size <= 0) {
      return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const result = await pdfParse(fileBuffer);
    const text = result.text.trim();

    if (text.length < minimumExtractedTextLength) {
      return NextResponse.json({ error: 'No text could be extracted from this PDF.' }, { status: 422 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Failed to extract PDF text:', error);
    return NextResponse.json({ error: 'Unable to extract text from this PDF right now.' }, { status: 500 });
  }
}
