import pdfParse from 'pdf-parse';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFile = formData.get('file');

    const isFileLike =
      uploadedFile !== null &&
      typeof uploadedFile === 'object' &&
      'arrayBuffer' in uploadedFile;

    if (!isFileLike) {
      return NextResponse.json({ error: 'A PDF file upload is required.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const data = await pdfParse(fileBuffer);
    const text = data.text;

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ error: 'No text could be extracted from this PDF.' }, { status: 400 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Failed to extract PDF text:', error);
    return NextResponse.json({ error: 'Unable to extract text from this PDF right now.' }, { status: 500 });
  }
}
