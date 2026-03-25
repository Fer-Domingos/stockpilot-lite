'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { createUserAction, type UserManagementResult } from '@/app/users/actions';

const initialState: UserManagementResult = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();

  return <button type="submit" disabled={pending}>{pending ? 'Creating...' : 'Create User'}</button>;
}

export function CreateUserForm() {
  const [state, formAction] = useFormState(createUserAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const passwordHint = password.length > 0 && password.length < 8
    ? 'Password must be at least 8 characters'
    : 'Use 12+ characters for a stronger password';

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setPassword('');
      setShowPassword(false);
    }
  }, [state.ok]);

  return (
    <section className="card">
      <div className="section-title">
        <div>
          <h3>Create User</h3>
          <p className="muted">Admins can create ADMIN and PM accounts with the existing password login.</p>
        </div>
      </div>

      <form action={formAction} ref={formRef} className="user-form-grid">
        <div className="user-form-field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required />
        </div>
        <div className="user-form-field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div className="user-form-field user-password-field">
          <label htmlFor="password">Password</label>
          <p className={`field-helper-text ${password.length > 0 && password.length < 8 ? 'field-helper-text-error' : ''}`} aria-live="polite">
            {passwordHint}
          </p>
          <div className="password-input-wrap">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle-button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        <div className="user-form-field">
          <label htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue="PM">
            <option value="PM">PM</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        <div className="user-form-actions">
          <SubmitButton />
        </div>
      </form>

      {state.error ? <p className="form-feedback form-feedback-error">{state.error}</p> : null}
      {state.ok ? <p className="form-feedback form-feedback-success">User created successfully.</p> : null}
    </section>
  );
}
