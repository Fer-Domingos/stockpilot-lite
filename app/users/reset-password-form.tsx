'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { PasswordGuidance } from '@/app/components/password-guidance';
import { resetPasswordAction, type UserManagementResult } from '@/app/users/actions';

const initialState: UserManagementResult = { ok: false };

function ResetPasswordButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="secondary-button">
      {pending ? 'Resetting...' : 'Reset Password'}
    </button>
  );
}

type ResetPasswordFormProps = {
  userId: string;
};

export function ResetPasswordForm({ userId }: ResetPasswordFormProps) {
  const [state, formAction] = useFormState(resetPasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [showConfirmTemporaryPassword, setShowConfirmTemporaryPassword] = useState(false);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setTemporaryPassword('');
    }
  }, [state.ok]);

  return (
    <form action={formAction} ref={formRef} className="reset-password-form">
      <input type="hidden" name="userId" value={userId} />
      <div className="password-input-row">
        <input
          name="temporaryPassword"
          type={showTemporaryPassword ? 'text' : 'password'}
          minLength={8}
          placeholder="Temporary password"
          aria-label="Temporary password"
          onChange={(event) => setTemporaryPassword(event.target.value)}
          required
        />
        <button
          type="button"
          className="tertiary-button"
          onClick={() => setShowTemporaryPassword((value) => !value)}
        >
          {showTemporaryPassword ? 'Hide' : 'Show'}
        </button>
      </div>
      <div className="password-input-row">
        <input
          name="confirmTemporaryPassword"
          type={showConfirmTemporaryPassword ? 'text' : 'password'}
          minLength={8}
          placeholder="Confirm temporary password"
          aria-label="Confirm temporary password"
          required
        />
        <button
          type="button"
          className="tertiary-button"
          onClick={() => setShowConfirmTemporaryPassword((value) => !value)}
        >
          {showConfirmTemporaryPassword ? 'Hide' : 'Show'}
        </button>
      </div>
      <PasswordGuidance password={temporaryPassword} />
      <ResetPasswordButton />
      {state.error ? <p className="form-feedback form-feedback-error">{state.error}</p> : null}
      {state.ok ? <p className="form-feedback form-feedback-success">Password reset.</p> : null}
    </form>
  );
}
