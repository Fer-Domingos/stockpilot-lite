'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import {
  deleteUserAction,
  updateUserRoleAction,
  type UserManagementResult,
} from '@/app/users/actions';

const initialState: UserManagementResult = { ok: false };

function RoleSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="secondary-button" disabled={pending}>
      {pending ? 'Saving...' : 'Save'}
    </button>
  );
}

function RemoveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="danger-button" disabled={disabled || pending}>
      {pending ? 'Removing...' : 'Remove'}
    </button>
  );
}

type UserManagementActionsProps = {
  userId: string;
  currentRole: 'ADMIN' | 'PM';
  isCurrentUser: boolean;
  removeDisabledReason?: string;
};

export function UserManagementActions({
  userId,
  currentRole,
  isCurrentUser,
  removeDisabledReason,
}: UserManagementActionsProps) {
  const [roleState, roleFormAction] = useFormState(updateUserRoleAction, initialState);
  const [deleteState, deleteFormAction] = useFormState(deleteUserAction, initialState);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (deleteState.ok) {
      deleteFormRef.current?.reset();
    }
  }, [deleteState.ok]);

  const removeDisabled = Boolean(removeDisabledReason) || isCurrentUser;
  const removeReason = isCurrentUser ? 'You cannot remove your own account.' : removeDisabledReason;

  return (
    <div className="user-management-actions">
      <form action={roleFormAction} className="user-role-form">
        <input type="hidden" name="userId" value={userId} />
        <label className="user-action-field">
          <span>Role</span>
          <select name="role" defaultValue={currentRole} aria-label="User role">
          <option value="ADMIN">ADMIN</option>
          <option value="PM">PM</option>
        </select>
        </label>
        <RoleSubmitButton />
      </form>
      {roleState.error ? <p className="form-feedback form-feedback-error">{roleState.error}</p> : null}
      {roleState.ok ? <p className="form-feedback form-feedback-success">Role updated.</p> : null}

      <form
        action={deleteFormAction}
        ref={deleteFormRef}
        className="user-remove-form"
        onSubmit={(event) => {
          if (removeDisabled) {
            event.preventDefault();
            return;
          }

          if (!window.confirm('Are you sure you want to remove this user?')) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        <RemoveButton disabled={removeDisabled} />
      </form>
      {removeReason ? <p className="form-feedback form-feedback-error">{removeReason}</p> : null}
      {deleteState.error ? <p className="form-feedback form-feedback-error">{deleteState.error}</p> : null}
      {deleteState.ok ? <p className="form-feedback form-feedback-success">User removed.</p> : null}
    </div>
  );
}
