'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { changePasswordAction, type ChangePasswordResult } from '@/app/account/actions';

const initialState: ChangePasswordResult = { ok: false };

function ChangePasswordButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="secondary-button" disabled={pending}>
      {pending ? 'Saving...' : 'Change Password'}
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useFormState(changePasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <form action={formAction} ref={formRef} className="change-password-form">
      <div>
        <label htmlFor="currentPassword">Current Password</label>
        <input id="currentPassword" name="currentPassword" type="password" minLength={6} required />
      </div>

      <div>
        <label htmlFor="newPassword">New Password</label>
        <input id="newPassword" name="newPassword" type="password" minLength={6} required />
      </div>

      <div>
        <label htmlFor="confirmNewPassword">Confirm New Password</label>
        <input id="confirmNewPassword" name="confirmNewPassword" type="password" minLength={6} required />
      </div>

      <ChangePasswordButton />
      {state.error ? <p className="form-feedback form-feedback-error">{state.error}</p> : null}
      {state.ok ? <p className="form-feedback form-feedback-success">Password updated.</p> : null}
    </form>
  );
}
