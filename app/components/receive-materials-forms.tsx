'use client';

import { useState } from 'react';

import { JobRecord, MaterialRecord } from '@/app/actions';
import { InvoiceImportReceiveForm } from '@/app/components/invoice-import-receive-form';
import { ReceiveMaterialForm } from '@/app/components/receive-material-form';

export function ReceiveMaterialsForms({
  materials,
  jobs,
  canPostReceipts
}: {
  materials: MaterialRecord[];
  jobs: JobRecord[];
  canPostReceipts: boolean;
}) {
  const [invoiceText, setInvoiceText] = useState('');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importMessageType, setImportMessageType] = useState<'success' | 'error' | null>(null);

  return (
    <>
      <section className="card">
        <div className="section-title">
          <h3>Receive Materials</h3>
          <p className="muted">Capture vendor receipts with invoice, destination, and optional photo reference.</p>
        </div>
        {canPostReceipts ? (
          <ReceiveMaterialForm
            materials={materials}
            jobs={jobs}
            onInvoiceTextExtracted={setInvoiceText}
            onInvoiceTextExtractionMessage={(message, type) => {
              setImportMessage(message);
              setImportMessageType(type);
            }}
          />
        ) : (
          <p className="muted">PM access is read-only. Receiving is available to ADMIN users only.</p>
        )}
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Import from Invoice Text</h3>
          <p className="muted">Paste raw invoice text, review mapped lines, and confirm destination and quantity before posting.</p>
        </div>
        {canPostReceipts ? (
          <InvoiceImportReceiveForm
            materials={materials}
            jobs={jobs}
            invoiceText={invoiceText}
            setInvoiceText={setInvoiceText}
            importMessage={importMessage}
            importMessageType={importMessageType}
          />
        ) : (
          <p className="muted">PM access is read-only. Invoice import posting is available to ADMIN users only.</p>
        )}
      </section>
    </>
  );
}
