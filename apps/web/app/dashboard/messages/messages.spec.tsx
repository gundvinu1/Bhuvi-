import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MessagesDashboardPage from './page';
import { useMessages } from '../../../lib/use-messages';
import { MessageDto, MessageStatsDto } from '@bhuvi/shared';

jest.mock('../../../lib/use-messages');

const mockUseMessages = useMessages as jest.MockedFunction<typeof useMessages>;

describe('Message Intelligence Dashboard Page', () => {
  const mockCreateMessage = jest.fn();
  const mockAnalyzePreview = jest.fn();
  const mockAnalyzeExistingMessage = jest.fn();
  const mockUpdateActionItemStatus = jest.fn();
  const mockDeleteMessage = jest.fn();
  const mockSelectMessage = jest.fn();
  const mockRefresh = jest.fn();
  const mockSetFilters = jest.fn();

  const sampleStats: MessageStatsDto = {
    totalMessages: 12,
    highPriorityCount: 4,
    urgentCount: 2,
    requiresActionCount: 5,
    requiresReplyCount: 3,
    completedCount: 11,
    pendingProcessingCount: 1,
    categoryDistribution: {
      WORK: 5,
      FINANCIAL: 2,
      PERSONAL: 1,
      EDUCATION: 1,
      BUSINESS: 1,
      SOCIAL: 0,
      PROMOTIONAL: 1,
      TRANSACTIONAL: 1,
      NOTIFICATION: 0,
      OTHER: 0,
    },
  };

  const sampleMessage: MessageDto = {
    id: 'msg-abc-123',
    userId: 'user-1',
    source: 'MANUAL',
    senderName: 'Sarah Jenkins',
    senderIdentifier: 'sarah@acme.com',
    subject: 'Urgent Q4 Financial Review',
    content: 'Please submit the finalized Q4 audit report before next Friday.',
    receivedAt: '2026-11-07T12:00:00Z',
    createdAt: '2026-11-07T12:00:00Z',
    updatedAt: '2026-11-07T12:00:00Z',
    processingStatus: 'COMPLETED',
    analysis: {
      id: 'analysis-1',
      messageId: 'msg-abc-123',
      category: 'WORK',
      priority: 'HIGH',
      priorityExplanation: 'Critical financial review deliverable',
      urgency: 'TIME_SENSITIVE',
      intent: 'REQUEST',
      sentiment: 'NEUTRAL',
      summary: 'Sarah requests submission of the Q4 financial audit report.',
      requiresReply: true,
      requiresAction: true,
      confidence: 0.94,
      extractedEntities: [{ type: 'DOCUMENT', value: 'Q4 audit report' }],
      analysisMetadata: null,
      createdAt: '2026-11-07T12:00:00Z',
      updatedAt: '2026-11-07T12:00:00Z',
    },
    actionItems: [
      {
        id: 'act-1',
        messageId: 'msg-abc-123',
        userId: 'user-1',
        title: 'Submit finalized Q4 audit report',
        description: 'Send figures to Sarah Jenkins',
        priority: 'HIGH',
        dueDate: '2026-11-14T17:00:00Z',
        status: 'PENDING',
        createdAt: '2026-11-07T12:00:00Z',
        updatedAt: '2026-11-07T12:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMessages.mockReturnValue({
      messages: [sampleMessage],
      activeMessage: sampleMessage,
      stats: sampleStats,
      actionItems: sampleMessage.actionItems || [],
      isLoading: false,
      isSubmitting: false,
      error: null,
      filters: {},
      setFilters: mockSetFilters,
      createMessage: mockCreateMessage,
      analyzePreview: mockAnalyzePreview,
      analyzeExistingMessage: mockAnalyzeExistingMessage,
      updateActionItemStatus: mockUpdateActionItemStatus,
      deleteMessage: mockDeleteMessage,
      selectMessage: mockSelectMessage,
      refresh: mockRefresh,
    });
  });

  it('renders header, stats metrics, and message list', () => {
    render(<MessagesDashboardPage />);

    expect(screen.getByText('Message Intelligence')).toBeDefined();
    expect(screen.getByText('Module 07')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined(); // Total
    expect(screen.getAllByText('Sarah Jenkins').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Urgent Q4 Financial Review').length).toBeGreaterThanOrEqual(1);
  });

  it('renders detailed view of active message including summary and action items', () => {
    render(<MessagesDashboardPage />);

    expect(
      screen.getByText('Sarah requests submission of the Q4 financial audit report.'),
    ).toBeDefined();
    expect(screen.getByText('Submit finalized Q4 audit report')).toBeDefined();
    expect(screen.getByText('Critical financial review deliverable')).toBeDefined();
    expect(screen.getByText('DOCUMENT:')).toBeDefined();
    expect(screen.getByText('Q4 audit report')).toBeDefined();
  });

  it('toggles action item completion when checkbox is clicked', () => {
    render(<MessagesDashboardPage />);

    const checkbox = screen.getByRole('button', { name: '' });
    if (checkbox) {
      fireEvent.click(checkbox);
      expect(mockUpdateActionItemStatus).toHaveBeenCalledWith('act-1', 'COMPLETED');
    }
  });

  it('switches to AI Analyzer playground tab and renders form', () => {
    render(<MessagesDashboardPage />);

    const playgroundTab = screen.getByText('AI Analyzer');
    fireEvent.click(playgroundTab);

    expect(screen.getByText('Manual Message Submission & AI Testing')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g. Sarah Jenkins')).toBeDefined();
    expect(screen.getByText('Preview Live Analysis')).toBeDefined();
  });

  it('submits preview in AI Analyzer tab', async () => {
    mockAnalyzePreview.mockResolvedValue({
      category: 'NOTIFICATION',
      priority: 'CRITICAL',
      urgency: 'URGENT',
      intent: 'INFORMATION',
      sentiment: 'NEGATIVE',
      summary: 'Security breach detected',
      requiresReply: false,
      requiresAction: true,
      confidence: 0.99,
      actionItems: [],
      entities: [],
    });

    render(<MessagesDashboardPage />);

    // Switch tab
    fireEvent.click(screen.getByText('AI Analyzer'));

    // Type content
    const textarea = screen.getByPlaceholderText(
      'Paste untrusted message text here... Prompt injection defense is active.',
    );
    fireEvent.change(textarea, { target: { value: 'Security alert: account breached' } });

    const previewBtn = screen.getByText('Preview Live Analysis');
    fireEvent.click(previewBtn);

    expect(mockAnalyzePreview).toHaveBeenCalledWith({
      content: 'Security alert: account breached',
      senderName: undefined,
      subject: undefined,
    });
  });
});
