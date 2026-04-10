import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './auth-context';

const { deleteAccountMock, getMeMock, logoutUserMock, openMock } = vi.hoisted(() => ({
  deleteAccountMock: vi.fn(),
  getMeMock: vi.fn(),
  logoutUserMock: vi.fn(),
  openMock: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  deleteAccount: deleteAccountMock,
  getMe: getMeMock,
  logoutUser: logoutUserMock,
}));

function LoginConsumer() {
  const { login } = useAuth();

  return <button onClick={login}>Login</button>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMeMock.mockRejectedValue(new Error('Not signed in'));
    openMock.mockReturnValue({});
    vi.stubGlobal('open', openMock);
  });

  it('replaces the previous popup message listener when login is triggered again', async () => {
    const user = userEvent.setup();
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    render(
      <AuthProvider>
        <LoginConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(getMeMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Login' }));
    await user.click(screen.getByRole('button', { name: 'Login' }));

    const messageAdds = addEventListenerSpy.mock.calls.filter(([eventName]) => eventName === 'message');
    expect(messageAdds).toHaveLength(2);

    const firstHandler = messageAdds[0][1];
    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', firstHandler);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
