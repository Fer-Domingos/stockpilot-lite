import path from 'node:path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const maxFileSizeBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

const ocrPrompt =
  'Extract all readable text from this invoice document. Return plain text only, preserving line breaks where possible. Do not add explanations.';

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

function parseOpenAiOutputText(payload: OpenAIResponse) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  const fragments: string[] = [];
  for (const outputItem of payload.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (contentItem.type === 'output_text' && typeof contentItem.text === 'string') {
        fragments.push(contentItem.text);
      }
    }
  }

  return fragments.join('\n').trim();
}

async function extractPdfEmbeddedText(file: File) {
  const raw = Buffer.from(await file.arrayBuffer()).toString('latin1');
  const textBlocks = raw.match(/BT[\s\S]*?ET/g) ?? [];
  const parts: string[] = [];

  const decodePdfTextLiteral = (literal: string) =>
    literal
      .replace(/\\([nrtbf()\\])/g, (_match, escaped) => {
        if (escaped === 'n') return '\n';
        if (escaped === 'r') return '\r';
        if (escaped === 't') return '\t';
        if (escaped === 'b') return '\b';
        if (escaped === 'f') return '\f';
        return escaped;
      })
      .replace(/\\([0-7]{1,3})/g, (_match, octal) => String.fromCharCode(Number.parseInt(octal, 8)));

  for (const block of textBlocks) {
    const directText = [...block.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)];
    for (const token of directText) {
      const decoded = decodePdfTextLiteral(token[1]).trim();
      if (decoded.length > 0) {
        parts.push(decoded);
      }
    }

    const arrayText = [...block.matchAll(/\[(.*?)\]\s*TJ/gs)];
    for (const arrayToken of arrayText) {
      const literals = [...arrayToken[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)];
      const joined = literals.map((entry) => decodePdfTextLiteral(entry[1])).join(' ').trim();
      if (joined.length > 0) {
        parts.push(joined);
      }
    }
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function extractTextWithOpenAIVision(file: File) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OCR is unavailable because OPENAI_API_KEY is not configured.');
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileData = `data:${file.type};base64,${fileBuffer.toString('base64')}`;
  const extension = path.extname(file.name || '').toLowerCase();
  const isPdf = extension === '.pdf' || file.type === 'application/pdf';

  const content = isPdf
    ? [
        { type: 'input_text', text: ocrPrompt },
        { type: 'input_file', filename: file.name || 'invoice.pdf', file_data: fileData }
      ]
    : [
        { type: 'input_text', text: ocrPrompt },
        { type: 'input_image', image_url: fileData }
      ];

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: [{ role: 'user', content }],
      temperature: 0
    })
  });

  const payload = (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message || 'OCR request failed.');
  }

  return parseOpenAiOutputText(payload);
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

    let extractedText = '';
    let method: 'pdf-embedded-text' | 'openai-vision-ocr' = 'openai-vision-ocr';
    let usedOcr = true;

    if (extension === '.pdf' || uploadedFile.type === 'application/pdf') {
      extractedText = await extractPdfEmbeddedText(uploadedFile);
      if (extractedText.length > 0) {
        method = 'pdf-embedded-text';
        usedOcr = false;
      }
    }

    if (extractedText.length === 0) {
      extractedText = await extractTextWithOpenAIVision(uploadedFile);
      method = 'openai-vision-ocr';
      usedOcr = true;
    }

    if (extractedText.length === 0) {
      return NextResponse.json({ error: 'OCR could not find readable text in the uploaded file.' }, { status: 422 });
    }

    return NextResponse.json({
      text: extractedText,
      method,
      usedOcr
    });
  } catch (error) {
    console.error('Failed to extract invoice text:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to extract invoice text right now.' },
      { status: 500 }
    );
  }
}
