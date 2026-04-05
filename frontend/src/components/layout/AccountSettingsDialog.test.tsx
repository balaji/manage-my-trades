import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AccountSettingsDialog } from './AccountSettingsDialog';

const user = {
  id: '7b3d8f5f-6c65-4b54-bbd5-3c8dd66dd8c0',
  name: 'Ada Lovelace',
  picture: null,
};

describe('AccountSettingsDialog', () => {
  it('calls onDeleteAccount when the delete account button is clicked and confirmed', async () => {
    const onLogout = vi.fn();
    const onDeleteAccount = vi.fn();

    render(<AccountSettingsDialog user={user} onLogout={onLogout} onDeleteAccount={onDeleteAccount} />);

    fireEvent.click(screen.getByTitle('Account settings'));

    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

    expect(onDeleteAccount).toHaveBeenCalledOnce();
  });

  it('does not call onDeleteAccount if confirmation is not clicked', async () => {
    const onLogout = vi.fn();
    const onDeleteAccount = vi.fn();

    render(<AccountSettingsDialog user={user} onLogout={onLogout} onDeleteAccount={onDeleteAccount} />);

    fireEvent.click(screen.getByTitle('Account settings'));

    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));

    expect(onDeleteAccount).not.toHaveBeenCalled();
  });
});
