'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { PasswordGuidance } from '@/app/components/password-guidance';
import { resetPasswordAction, type UserManagementResult } from '@/app/users/actions';

const initialState: UserManagementResult = { ok: false };

function ResetPasswordButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="secondary-button" disabled={pending}>
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

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setTemporaryPassword('');
    }
  }, [state.ok]);

  return (
    <form action={formAction} ref={formRef} className="reset-password-form">
      <input type="hidden" name="userId" value={userId} />
      <input
        name="temporaryPassword"
        type="password"
        minLength={8}
        placeholder="Temporary password"
        aria-label="Temporary password"
        onChange={(event) => setTemporaryPassword(event.target.value)}
        required
      />
      <PasswordGuidance password={temporaryPassword} />
      <ResetPasswordButton />
      {state.error ? <p className="form-feedback form-feedback-error">{state.error}</p> : null}
      {state.ok ? <p className="form-feedback form-feedback-success">Password reset.</p> : null}
    </form>
  );
}
