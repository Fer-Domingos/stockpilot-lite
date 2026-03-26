'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function JobsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Jobs page client error:', error);
  }, [error]);

  return (
    <section className="card">
      <h3>Jobs is temporarily unavailable</h3>
      <p className="muted">The page hit an unexpected client error. Try reloading Jobs.</p>
      <div className="row-actions">
        <button type="button" onClick={reset}>
          Retry
        </button>
        <Link className="secondary-button" href="/dashboard">
          Go to Dashboard
        </Link>
      </div>
    </section>
  );
}
