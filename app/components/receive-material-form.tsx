'use client';

import { useMemo, useState } from 'react';

import { JobRecord, MaterialRecord, receiveMaterial } from '@/app/actions';

type UploadResponse = {
  fileName: string;
  url: string;
};

type ExtractResponse = {
  extractedText?: string;
  invoiceText?: string;
  text?: string;
  content?: string;
  error?: string;
};

const maxSizeMb = 10;
const acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

export function ReceiveMaterialForm({ materials, jobs }: { materials: MaterialRecord[]; jobs: JobRecord[] }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedInvoice, setUploadedInvoice] = useState<UploadResponse | null>(null);
  const [isProcessingInvoice, setIsProcessingInvoice] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

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
    setProcessingError(null);
    setProcessingMessage(null);
    setIsUploading(true);
    let uploadedFile: UploadResponse | null = null;

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

      uploadedFile = { fileName: payload.fileName, url: payload.url };
      setUploadedInvoice(uploadedFile);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }

    if (!uploadedFile) {
      return;
    }

    setIsProcessingInvoice(true);
    setProcessingMessage('Processing invoice...');

    try {
      const extractResponse = await fetch('/api/invoices/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileUrl: uploadedFile.url
        })
      });
      const extractPayload = (await extractResponse.json()) as ExtractResponse;
      const extractedText =
        extractPayload.extractedText ?? extractPayload.invoiceText ?? extractPayload.text ?? extractPayload.content ?? '';

      if (!extractResponse.ok || !extractedText.trim()) {
        throw new Error(extractPayload.error || 'Invoice extraction failed.');
      }

      window.dispatchEvent(
        new CustomEvent('invoice-extracted', {
          detail: {
            text: extractedText
          }
        })
      );

      setProcessingMessage('Invoice processed successfully');
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'Invoice extraction failed.');
      setProcessingMessage(null);
    } finally {
      setIsProcessingInvoice(false);
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

        <button
          type="button"
          onClick={handleInvoiceUpload}
          disabled={isUploading || isProcessingInvoice}
          style={{ marginTop: '0.5rem' }}
        >
          {isUploading ? 'Uploading...' : 'Upload Invoice'}
        </button>

        {uploadError ? <p style={{ color: '#b42318', marginTop: '0.5rem' }}>{uploadError}</p> : null}
        {isProcessingInvoice ? <p style={{ color: '#475467', marginTop: '0.5rem' }}>Processing invoice...</p> : null}
        {!isProcessingInvoice && processingMessage ? (
          <p style={{ color: '#027a48', marginTop: '0.5rem' }}>{processingMessage}</p>
        ) : null}
        {processingError ? <p style={{ color: '#b42318', marginTop: '0.5rem' }}>{processingError}</p> : null}

        {uploadedInvoice ? (
          <div style={{ marginTop: '0.5rem' }}>
            <p style={{ marginBottom: '0.25rem' }}>
              <strong>Uploaded:</strong> {uploadedInvoice.fileName}
            </p>
            <a href={uploadedInvoice.url} target="_blank" rel="noreferrer">
              Open uploaded invoice
            </a>
          </div>
        ) : null}
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
