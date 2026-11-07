import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/dashboard/settings',
}));

jest.mock('../../../lib/auth-context');

import { useAuth } from '../../../lib/auth-context';
import SettingsPage from './page';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('SettingsPage', () => {
  const mockUser = {
    id: 'user-uuid-12345',
    email: 'vinayak@example.com',
    name: 'Vinayak Gund',
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
  };

  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
      error: null,
      logout: mockLogout,
      refreshUser: jest.fn(),
    });
  });

  it('renders authenticated user profile data from /api/v1/auth/me', () => {
    render(<SettingsPage />);

    expect(screen.getByText('Settings & Preferences')).toBeDefined();
    expect(screen.getByText('Vinayak Gund')).toBeDefined();
    expect(screen.getByText('vinayak@example.com')).toBeDefined();
    expect(screen.getByText('user-uuid-12345')).toBeDefined();
  });

  it('renders security and infrastructure information without exposing secrets', () => {
    render(<SettingsPage />);

    expect(screen.getByText(/HttpOnly, SameSite=Lax Cookie/i)).toBeDefined();
    expect(screen.getByText(/PostgreSQL 16 \+ Prisma ORM/i)).toBeDefined();
    expect(screen.getByText(/BullMQ 5 on Redis 7/i)).toBeDefined();
  });

  it('supports theme preference selection in UI', () => {
    render(<SettingsPage />);

    const lightThemeButton = screen.getByRole('button', { name: /Light Mode/i });
    fireEvent.click(lightThemeButton);
    expect(lightThemeButton.className).toContain('border-bhuvi-500');
  });

  it('triggers logout action when Sign Out button is clicked', async () => {
    render(<SettingsPage />);

    const logoutButton = screen.getByRole('button', { name: /Sign Out of BHUVI/i });
    fireEvent.click(logoutButton);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
