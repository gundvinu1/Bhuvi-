import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssistantPanel } from './assistant-panel';
import { useAi } from '../../lib/use-ai';

jest.mock('../../lib/use-ai');

const mockUseAi = useAi as jest.MockedFunction<typeof useAi>;

describe('AssistantPanel Component', () => {
  const mockSendMessage = jest.fn();
  const mockClearChat = jest.fn();
  const mockRefreshStatus = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAi.mockReturnValue({
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
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      refreshStatus: mockRefreshStatus,
    });
  });

  it('renders BHUVI Assistant header and connected model badge', () => {
    render(<AssistantPanel />);

    expect(screen.getByText('BHUVI Assistant')).toBeDefined();
    expect(screen.getByText('Ollama: Connected (qwen2.5:3b)')).toBeDefined();
  });

  it('displays degraded badge when model is missing', () => {
    mockUseAi.mockReturnValue({
      status: {
        provider: 'ollama',
        status: 'degraded',
        model: 'qwen2.5:3b',
        modelAvailable: false,
        error: 'Model missing',
      },
      isStatusLoading: false,
      statusError: null,
      messages: [],
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      refreshStatus: mockRefreshStatus,
    });

    render(<AssistantPanel />);
    expect(screen.getByText('Model Missing: qwen2.5:3b')).toBeDefined();
  });

  it('displays offline badge when Ollama is unavailable', () => {
    mockUseAi.mockReturnValue({
      status: {
        provider: 'ollama',
        status: 'unavailable',
        model: 'qwen2.5:3b',
        modelAvailable: false,
        error: 'ECONNREFUSED',
      },
      isStatusLoading: false,
      statusError: 'ECONNREFUSED',
      messages: [],
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      refreshStatus: mockRefreshStatus,
    });

    render(<AssistantPanel />);
    expect(screen.getByText(/Ollama: Offline/i)).toBeDefined();
  });

  it('submits user message on form submit and calls sendMessage', async () => {
    render(<AssistantPanel />);

    const input = screen.getByPlaceholderText(/Ask BHUVI anything/i);
    fireEvent.change(input, { target: { value: 'Explain quantum physics' } });

    const submitBtn = screen.getByRole('button', { name: /Send message to BHUVI/i });
    fireEvent.click(submitBtn);

    expect(mockSendMessage).toHaveBeenCalledWith('Explain quantum physics');
  });

  it('renders message stream with user and assistant bubbles', () => {
    mockUseAi.mockReturnValue({
      status: {
        provider: 'ollama',
        status: 'connected',
        model: 'qwen2.5:3b',
        modelAvailable: true,
      },
      isStatusLoading: false,
      statusError: null,
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'What is BHUVI?',
          timestamp: '2026-11-07T12:00:00Z',
        },
        {
          id: '2',
          role: 'assistant',
          content: 'BHUVI is your local personal AI operating system.',
          model: 'qwen2.5:3b',
          durationMs: 420,
          timestamp: '2026-11-07T12:00:01Z',
        },
      ],
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      refreshStatus: mockRefreshStatus,
    });

    render(<AssistantPanel />);

    expect(screen.getByText('What is BHUVI?')).toBeDefined();
    expect(screen.getByText('BHUVI is your local personal AI operating system.')).toBeDefined();
    expect(screen.getByText('420ms')).toBeDefined();
    expect(screen.getByRole('button', { name: /Clear/i })).toBeDefined();
  });

  it('displays loading state indicator while generating response', () => {
    mockUseAi.mockReturnValue({
      status: {
        provider: 'ollama',
        status: 'connected',
        model: 'qwen2.5:3b',
        modelAvailable: true,
      },
      isStatusLoading: false,
      statusError: null,
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'Thinking question...',
          timestamp: '2026-11-07T12:00:00Z',
        },
      ],
      isLoading: true,
      error: null,
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      refreshStatus: mockRefreshStatus,
    });

    render(<AssistantPanel />);
    expect(screen.getByText('BHUVI is thinking...')).toBeDefined();
  });

  it('displays error alert when error is returned', () => {
    mockUseAi.mockReturnValue({
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
      error: 'Ollama model inference timed out',
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
      refreshStatus: mockRefreshStatus,
    });

    render(<AssistantPanel />);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Ollama model inference timed out')).toBeDefined();
  });
});
