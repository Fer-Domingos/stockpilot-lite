'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { changePasswordAction, type ChangePasswordResult } from '@/app/account/actions';
import { PasswordGuidance } from '@/app/components/password-guidance';

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
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setNewPassword('');
    }
  }, [state.ok]);

  return (
    <form action={formAction} ref={formRef} className="change-password-form">
      <div>
        <label htmlFor="currentPassword">Current Password</label>
        <div className="password-input-row">
          <input id="currentPassword" name="currentPassword" type={showCurrentPassword ? 'text' : 'password'} required />
          <button type="button" className="tertiary-button" onClick={() => setShowCurrentPassword((value) => !value)}>
            {showCurrentPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="newPassword">New Password</label>
        <div className="password-input-row">
          <input
            id="newPassword"
            name="newPassword"
            type={showNewPassword ? 'text' : 'password'}
            minLength={8}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <button type="button" className="tertiary-button" onClick={() => setShowNewPassword((value) => !value)}>
            {showNewPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <PasswordGuidance password={newPassword} />
      </div>

      <div>
        <label htmlFor="confirmNewPassword">Confirm New Password</label>
        <div className="password-input-row">
          <input
            id="confirmNewPassword"
            name="confirmNewPassword"
            type={showConfirmNewPassword ? 'text' : 'password'}
            minLength={8}
            required
          />
          <button
            type="button"
            className="tertiary-button"
            onClick={() => setShowConfirmNewPassword((value) => !value)}
          >
            {showConfirmNewPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <ChangePasswordButton />
      {state.error ? <p className="form-feedback form-feedback-error">{state.error}</p> : null}
      {state.ok ? <p className="form-feedback form-feedback-success">Password updated.</p> : null}
    </form>
  );
}
