import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: jest.fn(),
  }),
  usePathname: () => '/dashboard',
}));

jest.mock('../../lib/auth-context', () => {
  const original = jest.requireActual('../../lib/auth-context');
  return {
    ...original,
    useAuth: jest.fn(),
  };
});

jest.mock('../../lib/use-ai', () => ({
  useAi: () => ({
    status: {
      provider: 'ollama',
      status: 'connected',
      model: 'qwen2.5:3b',
      modelAvailable: true,
    },
    isStatusLoading: false,
    statusError: null,
    messages: [],
    isLoading: false,
    error: null,
    sendMessage: jest.fn(),
    clearChat: jest.fn(),
    refreshStatus: jest.fn(),
  }),
}));

import { useAuth } from '../../lib/auth-context';
import DashboardOverviewPage from './page';
import DashboardLayout from './layout';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('DashboardOverviewPage', () => {
  const mockUser = {
    id: 'user-uuid-12345',
    email: 'vinayak@example.com',
    name: 'Vinayak Gund',
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
      error: null,
      logout: jest.fn(),
      refreshUser: jest.fn(),
    });
  });

  it('renders personalized welcome greeting and user first name', () => {
    render(<DashboardOverviewPage />);

    expect(screen.getByText(/Vinayak/i)).toBeDefined();
    expect(screen.getByText(/BHUVI Local AI OS · Ready/i)).toBeDefined();
    expect(screen.getByText(/Local-First Mode Active/i)).toBeDefined();
  });

  it('renders all four statistics cards with honest placeholder values and module badges', () => {
    render(<DashboardOverviewPage />);

    // Total Messages
    expect(screen.getByText('Total Messages')).toBeDefined();
    // Unread Messages
    expect(screen.getByText('Unread Messages')).toBeDefined();
    // Pending Tasks
    expect(screen.getByText('Pending Tasks')).toBeDefined();
    // Connected Accounts
    expect(screen.getByText('Connected Accounts')).toBeDefined();

    // Verify all four display honest placeholders (no fake numbers)
    const placeholders = screen.getAllByText('Coming soon');
    expect(placeholders.length).toBe(4);

    expect(screen.getAllByText('Module 07').length).toBe(2);
    expect(screen.getByText('Module 12')).toBeDefined();
    expect(screen.getByText('Modules 09-11')).toBeDefined();
  });

  it('renders AI Assistant panel with input, send button, and suggestion pills', () => {
    render(<DashboardOverviewPage />);

    expect(screen.getByText('BHUVI Assistant')).toBeDefined();
    const input = screen.getByPlaceholderText(/Ask BHUVI anything or type an instruction.../i);
    expect(input).toBeDefined();

    // Verify suggestions
    expect(
      screen.getByText('Explain what artificial intelligence is in simple English'),
    ).toBeDefined();
    expect(screen.getByText('What should I focus on today?')).toBeDefined();
    expect(
      screen.getByText('Summarize the core benefits of a local-first AI operating system'),
    ).toBeDefined();
  });

  it('renders empty states for Recent Activity and Daily Intelligence', () => {
    render(<DashboardOverviewPage />);

    expect(screen.getByText('Recent Activity')).toBeDefined();
    expect(
      screen.getByText(
        'No activity yet. Your activity will appear here when BHUVI starts working.',
      ),
    ).toBeDefined();

    expect(screen.getByText('Daily Intelligence Briefing')).toBeDefined();
    expect(screen.getByText('Your daily intelligence report will appear here.')).toBeDefined();
  });

  it('redirects unauthenticated users to /login via AuthGuard in layout', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: 'Unauthorized',
      logout: jest.fn(),
      refreshUser: jest.fn(),
    });

    render(
      <DashboardLayout>
        <div>Protected Content</div>
      </DashboardLayout>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });
});
