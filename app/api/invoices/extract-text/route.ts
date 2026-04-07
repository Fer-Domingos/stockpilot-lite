import { NextResponse } from 'next/server';

import { extractInvoiceTextFromPdfBuffer } from '@/lib/invoice-text-extraction';

export const runtime = 'nodejs';

const maxFileSizeBytes = 10 * 1024 * 1024;

function isFileLike(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

async function loadPdfBufferFromRequest(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const uploadedFile = formData.get('file');

    if (!isFileLike(uploadedFile)) {
      throw new Error('A PDF file is required.');
    }

    if (uploadedFile.size <= 0) {
      throw new Error('Uploaded file is empty.');
    }

    if (uploadedFile.size > maxFileSizeBytes) {
      throw new Error('File size exceeds the 10MB limit.');
    }

    if (uploadedFile.type !== 'application/pdf') {
      throw new Error('Only PDF files are supported for text extraction.');
    }

    const arrayBuffer = await uploadedFile.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const payload = (await request.json()) as { fileUrl?: string };

  if (!payload.fileUrl) {
    throw new Error('A fileUrl is required for JSON requests.');
  }

  const fileResponse = await fetch(payload.fileUrl, { cache: 'no-store' });

  if (!fileResponse.ok) {
    throw new Error('Unable to download the invoice PDF.');
  }

  const fileBytes = Buffer.from(await fileResponse.arrayBuffer());

  if (fileBytes.byteLength > maxFileSizeBytes) {
    throw new Error('File size exceeds the 10MB limit.');
  }

  return fileBytes;
}

export async function POST(request: Request) {
  try {
    const pdfBuffer = await loadPdfBufferFromRequest(request);
    const { text, extractionMethod } = await extractInvoiceTextFromPdfBuffer(pdfBuffer);

    return NextResponse.json({
      text,
      extractionMethod
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to extract invoice text right now.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
