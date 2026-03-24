'use client';

type PasswordGuidanceProps = {
  password: string;
  minLength?: number;
};

export function PasswordGuidance({ password, minLength = 8 }: PasswordGuidanceProps) {
  if (!password) {
    return null;
  }

  if (password.length < minLength) {
    return (
      <p className="form-feedback form-feedback-error" aria-live="polite">
        Password must be at least 8 characters
      </p>
    );
  }

  if (password.length < 12) {
    return (
      <p className="form-feedback" aria-live="polite">
        Use 12+ characters for a stronger password
      </p>
    );
  }

  return null;
}
