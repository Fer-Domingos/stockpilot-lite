'use client';

import { useEffect, useMemo, useState } from 'react';

const CHECK_INTERVAL_MS = 60_000;
const SESSION_KEY = 'update-banner-shown';
const BODY_CLASS = 'update-banner-visible';

function isUserEditingForm() {
  const activeElement = document.activeElement;

  if (!activeElement) {
    return false;
  }

  const tagName = activeElement.tagName;

  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLSelectElement) {
    return true;
  }

  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  return (activeElement as HTMLElement).isContentEditable;
}

export function UpdateNotificationBanner({ currentVersion }: { currentVersion: string }) {
  const [showBanner, setShowBanner] = useState(false);
  const [canCheckForUpdates, setCanCheckForUpdates] = useState(false);

  const endpoint = useMemo(() => `/api/version?t=${Date.now()}`, []);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem(SESSION_KEY) === 'true';
    if (!alreadyShown) {
      setCanCheckForUpdates(true);
    }
  }, []);

  useEffect(() => {
    if (!canCheckForUpdates || showBanner) {
      return;
    }

    let cancelled = false;

    const checkForUpdate = async () => {
      if (cancelled || isUserEditingForm()) {
        return;
      }

      try {
        const response = await fetch(endpoint, { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { version?: string };
        if (!payload.version || payload.version === currentVersion) {
          return;
        }

        if (!cancelled) {
          setShowBanner(true);
          sessionStorage.setItem(SESSION_KEY, 'true');
        }
      } catch {
        // Ignore transient network failures during polling.
      }
    };

    void checkForUpdate();
    const intervalId = window.setInterval(() => {
      void checkForUpdate();
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [canCheckForUpdates, currentVersion, endpoint, showBanner]);

  useEffect(() => {
    document.body.classList.toggle(BODY_CLASS, showBanner);
    return () => {
      document.body.classList.remove(BODY_CLASS);
    };
  }, [showBanner]);

  if (!showBanner) {
    return null;
  }

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <p>System update available. Refresh to apply the latest improvements.</p>
      <button
        type="button"
        className="update-banner-button"
        onClick={() => {
          setShowBanner(false);
          window.location.reload();
        }}
      >
        Refresh
      </button>
    </div>
  );
}
