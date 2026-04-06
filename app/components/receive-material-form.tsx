'use client';

import { useMemo, useState } from 'react';

import { JobRecord, MaterialRecord, receiveMaterial } from '@/app/actions';

type UploadResponse = {
  fileName: string;
  url: string;
};

const maxSizeMb = 10;
const acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

export function ReceiveMaterialForm({ materials, jobs }: { materials: MaterialRecord[]; jobs: JobRecord[] }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [uploadedInvoice, setUploadedInvoice] = useState<UploadResponse | null>(null);

  const acceptValue = useMemo(() => '.pdf,.jpg,.jpeg,.png', []);

  async function handleInvoiceUpload() {
    if (!selectedFile) {
      setUploadError('Select a PDF or image file to upload.');
      return;
    }

    if (!acceptedTypes.includes(selectedFile.type)) {
      setUploadError('Only PDF, JPG, JPEG, and PNG files are allowed.');
      return;
    }

    if (selectedFile.size > maxSizeMb * 1024 * 1024) {
      setUploadError('Invoice file must be 10MB or smaller.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData
      });

      const payload = (await response.json()) as UploadResponse & { error?: string };

      if (!response.ok || !payload.url || !payload.fileName) {
        throw new Error(payload.error || 'Upload failed.');
      }

      setUploadedInvoice({ fileName: payload.fileName, url: payload.url });
      setExtractError(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  function decodePdfEscapedText(value: string) {
    return value
      .replace(/\\([nrtbf()\\])/g, (_, escaped: string) => {
        switch (escaped) {
          case 'n':
            return '\n';
          case 'r':
            return '\r';
          case 't':
            return '\t';
          case 'b':
            return '\b';
          case 'f':
            return '\f';
          default:
            return escaped;
        }
      })
      .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)));
  }

  async function extractTextFromPdf(file: File) {
    const data = new Uint8Array(await file.arrayBuffer());
    const decoded = new TextDecoder('latin1').decode(data);
    const extracted: string[] = [];
    const textObjectBlocks = decoded.match(/BT[\s\S]*?ET/g) ?? [];

    for (const block of textObjectBlocks) {
      const operatorMatches = block.match(/\((?:\\.|[^\\()])*\)\s*(?:Tj|')|\[(?:[\s\S]*?)\]\s*TJ/g) ?? [];
      for (const operation of operatorMatches) {
        if (operation.endsWith('TJ')) {
          const parts = operation.match(/\((?:\\.|[^\\()])*\)/g) ?? [];
          for (const part of parts) {
            extracted.push(decodePdfEscapedText(part.slice(1, -1)));
          }
        } else {
          const directMatch = operation.match(/\(([\s\S]*?)\)/);
          if (directMatch) {
            extracted.push(decodePdfEscapedText(directMatch[1]));
          }
        }
      }
    }

    return extracted.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  async function handleExtractInvoiceText() {
    if (!selectedFile || !uploadedInvoice) {
      setExtractError('Upload an invoice before extracting text.');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);

    try {
      let extractedText = '';

      if (selectedFile.type === 'application/pdf') {
        extractedText = await extractTextFromPdf(selectedFile);
      } else if (selectedFile.type === 'image/jpeg' || selectedFile.type === 'image/png') {
        throw new Error('Image OCR is not available in this build yet. Please paste text manually for JPG/PNG.');
      } else {
        throw new Error('Only PDF, JPG, JPEG, and PNG files are supported for extraction.');
      }

      if (!extractedText) {
        throw new Error('No readable text was found in the uploaded invoice.');
      }

      window.dispatchEvent(new CustomEvent('invoice-text-extracted', { detail: { text: extractedText } }));
    } catch (error) {
      setExtractError(error instanceof Error ? error.message : 'Failed to extract text from invoice.');
    } finally {
      setIsExtracting(false);
    }
  }

  return (
    <form action={receiveMaterial}>
      <div style={{ border: '1px solid #eaecf0', borderRadius: '0.75rem', padding: '0.75rem', marginBottom: '1rem' }}>
        <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Upload Invoice File</h4>
        <p className="muted" style={{ marginTop: 0 }}>
          Upload a PDF or image invoice and attach it to this receipt.
        </p>

        <label htmlFor="invoiceFile">Invoice File</label>
        <input
          id="invoiceFile"
          name="invoiceFile"
          type="file"
          accept={acceptValue}
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />

        <button type="button" onClick={handleInvoiceUpload} disabled={isUploading} style={{ marginTop: '0.5rem' }}>
          {isUploading ? 'Uploading...' : 'Upload Invoice'}
        </button>

        {uploadError ? <p style={{ color: '#b42318', marginTop: '0.5rem' }}>{uploadError}</p> : null}

        {uploadedInvoice ? (
          <div style={{ marginTop: '0.5rem' }}>
            <p style={{ marginBottom: '0.25rem' }}>
              <strong>Uploaded:</strong> {uploadedInvoice.fileName}
            </p>
            <a href={uploadedInvoice.url} target="_blank" rel="noreferrer">
              Open uploaded invoice
            </a>
            <div>
              <button
                type="button"
                className="secondary-button"
                onClick={handleExtractInvoiceText}
                disabled={isExtracting}
                style={{ marginTop: '0.5rem' }}
              >
                {isExtracting ? 'Extracting...' : 'Extract Text from Invoice'}
              </button>
            </div>
          </div>
        ) : null}
        {extractError ? <p style={{ color: '#b42318', marginTop: '0.5rem' }}>{extractError}</p> : null}
      </div>

      <input type="hidden" name="invoiceFileUrl" value={uploadedInvoice?.url ?? ''} readOnly />

      <label htmlFor="materialId">Material</label>
      <select id="materialId" name="materialId" required>
        <option value="">Select material</option>
        {materials.map((material) => (
          <option value={material.id} key={material.id}>
            {material.name} ({material.sku})
          </option>
        ))}
      </select>

      <label htmlFor="destination">Destination</label>
      <select id="destination" name="destination" required defaultValue="SHOP">
        <option value="SHOP">SHOP (General Inventory)</option>
        {jobs.map((job) => (
          <option key={job.id} value={`JOB:${job.id}`}>
            JOB {job.number} — {job.name}
          </option>
        ))}
      </select>

      <p className="muted">Choose SHOP for general stock, or choose a JOB to receive directly into that job allocation.</p>

      <label htmlFor="invoiceNumber">Invoice Number</label>
      <input id="invoiceNumber" name="invoiceNumber" placeholder="INV-100245" />

      <label htmlFor="vendorName">Vendor / Supplier</label>
      <input id="vendorName" name="vendorName" placeholder="Northwest Plywood Supply" />

      <label htmlFor="notes">Receiving Notes</label>
      <textarea id="notes" name="notes" rows={3} placeholder="Condition, PO references, discrepancies..." />

      <label htmlFor="photoUrl">Photo URL (optional placeholder for upload)</label>
      <input id="photoUrl" name="photoUrl" type="url" placeholder="https://example.com/invoice-photo.jpg" />

      <label htmlFor="quantity">Quantity Received</label>
      <input id="quantity" name="quantity" type="number" min="1" required />

      <button type="submit">Post Receipt</button>
    </form>
  );
}
