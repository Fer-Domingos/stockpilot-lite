'use client';

import { useEffect, useState, useTransition } from 'react';

import { sendManualPOAlertEmail } from '@/app/actions';

export function ManualPoAlertEmailButton({ alertId }: { alertId: string }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<null | { kind: 'success' | 'error'; message: string }>(null);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFeedback(null);
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  return (
    <>
      <button
        className="secondary-button"
        type="button"
        disabled={isPending}
        onClick={() => {
          setFeedback(null);
          startTransition(async () => {
            const result = await sendManualPOAlertEmail(alertId);

            if (result.ok) {
              setFeedback({ kind: 'success', message: 'Email sent successfully' });
              return;
            }

            setFeedback({ kind: 'error', message: 'Failed to send email' });
          });
        }}
      >
        {isPending ? 'Sending…' : 'Send Email'}
      </button>
      {feedback ? (
        <span
          className={feedback.kind === 'success' ? 'form-feedback-success' : 'form-feedback-error'}
          style={{ fontSize: '0.78rem', alignSelf: 'center' }}
        >
          {feedback.message}
        </span>
      ) : null}
    </>
  );
}
