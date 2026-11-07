import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/login',
}));

import LoginPage from './page';

describe('LoginPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('renders login form elements and links', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: /BHUVI Login/i })).toBeDefined();
    expect(screen.getByLabelText(/Email Address/i)).toBeDefined();
    expect(screen.getByLabelText(/^Password$/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeDefined();
    expect(screen.getByText(/Don't have an account\?/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /Register here/i })).toBeDefined();
  });

  it('submits with credentials: "include" and does NOT store tokens in sessionStorage or localStorage', async () => {
    const mockFetch = jest
      .fn()
      // First call: POST /api/v1/auth/login
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            user: { id: 'usr-123', email: 'test@example.com', name: 'Test User' },
            accessToken: 'mock-jwt-token',
          },
        }),
      })
      // Second call: GET /api/v1/auth/me verification
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 'usr-123', email: 'test@example.com', name: 'Test User' },
        }),
      });

    global.fetch = mockFetch as unknown as typeof fetch;

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: 'ValidPass123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Verify first call included credentials: 'include'
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );

    // Verify verified state rendered
    await waitFor(() => {
      expect(screen.getByText(/Session Verified/i)).toBeDefined();
    });

    // Crucial security check: no token persisted in client storage
    expect(sessionStorage.getItem('bhuvi_token')).toBeNull();
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });
});
