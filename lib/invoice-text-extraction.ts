import { createWorker } from 'tesseract.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

type PdfPage = Awaited<ReturnType<Awaited<ReturnType<typeof getDocument>>['getPage']>>;

const OCR_SCALE = 2;
const OCR_LANGUAGE = 'eng';

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function isLikelyUnreadableText(text: string) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return true;
  }

  const replacementChars = (normalized.match(/[\uFFFD]/g) ?? []).length;
  const privateUseChars = (normalized.match(/[\uE000-\uF8FF]/g) ?? []).length;
  const latinWordTokens = (normalized.match(/[A-Za-z]{2,}/g) ?? []).length;
  const suspiciousGlyphs = (normalized.match(/[□■▢▣▤▥▦▧▨▩]/g) ?? []).length;

  const replacementRatio = replacementChars / normalized.length;
  const privateUseRatio = privateUseChars / normalized.length;

  return replacementRatio > 0.03 || privateUseRatio > 0.15 || suspiciousGlyphs > 5 || latinWordTokens < 5;
}

async function extractTextFromPdfPage(page: PdfPage) {
  const textContent = await page.getTextContent();

  return textContent.items
    .map((item) => ('str' in item ? item.str : ''))
    .join(' ')
    .trim();
}

export async function renderPdfPageToImageBuffer(page: PdfPage) {
  const [{ createCanvas }, { default: pdfjsWorker }] = await Promise.all([
    import('@napi-rs/canvas'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs')
  ]);

  const viewport = page.getViewport({ scale: OCR_SCALE });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');

  await page.render({ canvasContext: context as never, viewport }).promise;

  // Ensure the worker module stays bundled for serverless environments.
  void pdfjsWorker;

  return canvas.toBuffer('image/png');
}

export async function ocrImageBuffer(buffer: Buffer) {
  const worker = await createWorker(OCR_LANGUAGE);

  try {
    const {
      data: { text }
    } = await worker.recognize(buffer);

    return text.trim();
  } finally {
    await worker.terminate();
  }
}

export async function extractInvoiceTextFromPdfBuffer(pdfBuffer: Buffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBuffer),
    disableWorker: true,
    useSystemFonts: true,
    verbosity: 0
  });

  const pdfDocument = await loadingTask.promise;

  try {
    const normalPageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      normalPageTexts.push(await extractTextFromPdfPage(page));
    }

    const normalText = normalPageTexts.join('\n\n').trim();

    if (!isLikelyUnreadableText(normalText)) {
      return {
        text: normalText,
        extractionMethod: 'pdf-text' as const
      };
    }

    const ocrTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const imageBuffer = await renderPdfPageToImageBuffer(page);
      const pageOcrText = await ocrImageBuffer(imageBuffer);
      ocrTexts.push(pageOcrText);
    }

    return {
      text: ocrTexts.join('\n\n').trim(),
      extractionMethod: 'ocr' as const
    };
  } finally {
    await pdfDocument.destroy();
  }
}
