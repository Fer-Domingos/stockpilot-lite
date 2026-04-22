import { PassThrough } from 'node:stream';

import * as PImage from 'pureimage';
import { createWorker } from 'tesseract.js';

const MAX_PDF_TEXT_PAGES = 8;
const MAX_PDF_OCR_PAGES = 3;
const MIN_MEANINGFUL_TEXT_LENGTH = 60;

const READABLE_CHAR_PATTERN = /[a-zA-Z0-9]/;
const SUSPECT_GLYPH_PATTERN = /[#<>"\\]/g;

function normalizeExtractedText(value: string) {
  return value.replace(/\u0000/g, '').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function isLikelyReadableText(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < MIN_MEANINGFUL_TEXT_LENGTH) {
    return false;
  }

  const readableChars = (trimmed.match(/[a-zA-Z0-9\s.,:$()\/-]/g) ?? []).length;
  const readableRatio = readableChars / trimmed.length;
  const hasWords = /[a-zA-Z]{3,}/.test(trimmed);
  const suspectGlyphCount = (trimmed.match(SUSPECT_GLYPH_PATTERN) ?? []).length;
  const suspectRatio = suspectGlyphCount / trimmed.length;

  return hasWords && readableRatio > 0.7 && suspectRatio < 0.2;
}

async function importPdfjs() {
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

async function extractPdfText(buffer: Buffer) {
  const pdfjs = await importPdfjs();
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  const pageCount = Math.min(document.numPages, MAX_PDF_TEXT_PAGES);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter((token) => token.length > 0)
      .join(' ')
      .trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  return normalizeExtractedText(pages.join('\n'));
}

async function ocrImageBuffer(imageBuffer: Buffer) {
  const worker = await createWorker('eng');

  try {
    const result = await worker.recognize(imageBuffer);
    return normalizeExtractedText(result.data.text ?? '');
  } finally {
    await worker.terminate();
  }
}

async function pureImageToPngBuffer(image: PImage.Bitmap) {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

  await PImage.encodePNGToStream(image, stream);

  return Buffer.concat(chunks);
}

async function renderPdfPageToImageBuffer(page: {
  getViewport: (input: { scale: number }) => { width: number; height: number };
  render: (input: { canvasContext: unknown; viewport: unknown }) => { promise: Promise<void> };
}) {
  const viewport = page.getViewport({ scale: 2 });
  const image = PImage.make(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = image.getContext('2d');

  await page.render({
    canvasContext: context,
    viewport
  }).promise;

  return pureImageToPngBuffer(image);
}

async function extractPdfTextWithOcrFallback(buffer: Buffer) {
  const directText = await extractPdfText(buffer);

  if (isLikelyReadableText(directText)) {
    return { text: directText, strategy: 'pdf-text' as const };
  }

  const pdfjs = await importPdfjs();
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageCount = Math.min(document.numPages, MAX_PDF_OCR_PAGES);
  const ocrPages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const pageImageBuffer = await renderPdfPageToImageBuffer(page);
    const pageText = await ocrImageBuffer(pageImageBuffer);

    if (READABLE_CHAR_PATTERN.test(pageText)) {
      ocrPages.push(pageText);
    }
  }

  const ocrText = normalizeExtractedText(ocrPages.join('\n\n'));

  if (ocrText) {
    return { text: ocrText, strategy: 'pdf-ocr' as const };
  }

  return { text: directText, strategy: 'pdf-text-unreadable' as const };
}

export async function extractInvoiceTextFromBuffer(buffer: Buffer, mimeType: string) {
  if (mimeType === 'application/pdf') {
    return extractPdfTextWithOcrFallback(buffer);
  }

  if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
    const text = await ocrImageBuffer(buffer);
    return { text, strategy: 'image-ocr' as const };
  }

  throw new Error('Unsupported file type for extraction.');
}
