'use client';

import { useEffect, useMemo, useState } from 'react';

const POLL_INTERVAL_MS = 60_000;
const SHOWN_SESSION_KEY = 'stockpilot:update-banner-seen';

function isUserEditingForm() {
  const activeElement = document.activeElement;

  if (!activeElement) {
    return false;
  }

  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLSelectElement) {
    return true;
  }

  return activeElement instanceof HTMLElement && activeElement.isContentEditable;
}

export function UpdateAvailableBanner({ currentVersion }: { currentVersion: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);
  const normalizedCurrentVersion = useMemo(() => currentVersion.trim(), [currentVersion]);

  useEffect(() => {
    setHasCheckedSession(sessionStorage.getItem(SHOWN_SESSION_KEY) === '1');
  }, []);

  useEffect(() => {
    if (hasCheckedSession) {
      return;
    }

    let isCancelled = false;

    async function checkForUpdate() {
      try {
        const response = await fetch('/api/version', { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { version?: string };
        const latestVersion = data.version?.trim();

        if (!latestVersion || latestVersion === normalizedCurrentVersion) {
          return;
        }

        if (isUserEditingForm()) {
          return;
        }

        if (isCancelled) {
          return;
        }

        sessionStorage.setItem(SHOWN_SESSION_KEY, '1');
        setIsVisible(true);
      } catch {
        // Silent fail; polling retries on next interval.
      }
    }

    checkForUpdate();
    const timer = window.setInterval(checkForUpdate, POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, [hasCheckedSession, normalizedCurrentVersion]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <p>System update available. Refresh to apply the latest improvements.</p>
      <button
        type="button"
        onClick={() => {
          setIsVisible(false);
          window.location.reload();
        }}
      >
        Refresh
      </button>
    </div>
  );
}
