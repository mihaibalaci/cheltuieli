import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../pages/Login';

// Mock the api module
vi.mock('../utils/api.js', () => ({
  api: {
    login: vi.fn(),
    forgotPassword: vi.fn(),
  },
}));

import { api } from '../utils/api.js';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Login page', () => {
  it('renders username and password fields', () => {
    render(<Login onLogin={() => {}} />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('calls onLogin and stores token on successful login', async () => {
    const onLogin = vi.fn();
    api.login.mockResolvedValue({ token: 'jwt-token', user: { id: 1, username: 'admin' } });

    render(<Login onLogin={onLogin} />);

    await userEvent.type(screen.getByLabelText(/username/i), 'admin');
    await userEvent.type(screen.getByLabelText(/password/i), 'admin');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('admin', 'admin');
      expect(localStorage.getItem('token')).toBe('jwt-token');
      expect(onLogin).toHaveBeenCalledWith({ id: 1, username: 'admin' });
    });
  });

  it('shows error message on failed login', async () => {
    api.login.mockRejectedValue(new Error('Invalid credentials'));

    render(<Login onLogin={() => {}} />);

    await userEvent.type(screen.getByLabelText(/username/i), 'admin');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('shows forgot password form when link is clicked', async () => {
    render(<Login onLogin={() => {}} />);
    fireEvent.click(screen.getByText(/forgot password/i));
    expect(screen.getByText(/reset password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('submits forgot password and shows confirmation', async () => {
    api.forgotPassword.mockResolvedValue({ ok: true });

    render(<Login onLogin={() => {}} />);
    fireEvent.click(screen.getByText(/forgot password/i));

    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(api.forgotPassword).toHaveBeenCalledWith('user@example.com');
      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
    });
  });

  it('navigates back to login from forgot password', async () => {
    render(<Login onLogin={() => {}} />);
    fireEvent.click(screen.getByText(/forgot password/i));
    fireEvent.click(screen.getByText(/back to sign in/i));
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});
