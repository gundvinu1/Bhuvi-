import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemStatus } from './system-status';
import { useHealth } from '../../lib/use-health';

jest.mock('../../lib/use-health');

const mockUseHealth = useHealth as jest.MockedFunction<typeof useHealth>;

describe('SystemStatus Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Healthy status indicator when backend is healthy', () => {
    mockUseHealth.mockReturnValue({
      health: {
        application: 'BHUVI',
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: 120,
        dependencies: {
          postgres: 'connected',
          redis: 'connected',
        },
      },
      status: 'healthy',
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });

    render(<SystemStatus />);
    expect(screen.getByText('System Healthy')).toBeDefined();
  });

  it('renders Degraded status when dependencies are degraded', () => {
    mockUseHealth.mockReturnValue({
      health: {
        application: 'BHUVI',
        status: 'degraded',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: 60,
        dependencies: {
          postgres: 'connected',
          redis: 'disconnected',
        },
      },
      status: 'degraded',
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });

    render(<SystemStatus />);
    expect(screen.getByText('System Degraded')).toBeDefined();
  });

  it('opens detailed telemetry popover on click without exposing secrets', () => {
    mockUseHealth.mockReturnValue({
      health: {
        application: 'BHUVI',
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: 3665, // 1h 1m
        dependencies: {
          postgres: 'connected',
          redis: 'connected',
        },
      },
      status: 'healthy',
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });

    render(<SystemStatus />);

    // Click popover button
    const trigger = screen.getByRole('button', { name: /System Healthy/i });
    fireEvent.click(trigger);

    expect(screen.getByText('System Infrastructure')).toBeDefined();
    expect(screen.getByText('PostgreSQL 16:')).toBeDefined();
    expect(screen.getByText('Redis 7:')).toBeDefined();
    expect(screen.getAllByText('connected').length).toBe(2);
    expect(screen.getByText('1h 1m')).toBeDefined();
  });
});
