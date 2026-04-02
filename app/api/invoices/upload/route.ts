import path from 'node:path';

import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const maxFileSizeBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFile = formData.get('file');

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: 'A file upload is required.' }, { status: 400 });
    }

    if (uploadedFile.size <= 0) {
      return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 });
    }

    if (uploadedFile.size > maxFileSizeBytes) {
      return NextResponse.json({ error: 'File size exceeds the 10MB limit.' }, { status: 400 });
    }

    const originalName = uploadedFile.name || 'invoice';
    const extension = path.extname(originalName).toLowerCase();

    if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(uploadedFile.type)) {
      return NextResponse.json({ error: 'Only PDF, JPG, JPEG, and PNG files are allowed.' }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeBaseName = sanitizeFileName(path.basename(originalName, extension)) || 'invoice';
    const finalFileName = `${timestamp}-${safeBaseName}${extension}`;
    const blobPath = `invoices/${finalFileName}`;

    const blob = await put(blobPath, uploadedFile, {
      access: 'public',
      addRandomSuffix: false
    });

    return NextResponse.json({
      fileName: finalFileName,
      url: blob.url
    });
  } catch (error) {
    console.error('Failed to upload invoice file:', error);
    return NextResponse.json({ error: 'Unable to upload invoice file right now.' }, { status: 500 });
  }
}
