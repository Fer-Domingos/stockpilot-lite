'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { PasswordGuidance } from '@/app/components/password-guidance';
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

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setPassword('');
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
        <div>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <PasswordGuidance password={password} />
        </div>
        <div>
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
