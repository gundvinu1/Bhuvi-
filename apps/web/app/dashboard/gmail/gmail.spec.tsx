import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import GmailDashboardPage from './page';
import { useGmail } from '../../../lib/use-gmail';
import { GmailConnectionDto, GmailSyncStatsDto, GmailMessageDto } from '@bhuvi/shared';

jest.mock('../../../lib/use-gmail');

const mockUseGmail = useGmail as jest.MockedFunction<typeof useGmail>;

describe('Gmail Integration Dashboard Page', () => {
  const mockConnectGmail = jest.fn();
  const mockDisconnectGmail = jest.fn();
  const mockTriggerSync = jest.fn();
  const mockSelectMessage = jest.fn();
  const mockSummarizeMessage = jest.fn();
  const mockSuggestReply = jest.fn();
  const mockCreateDraft = jest.fn();
  const mockAskAboutEmails = jest.fn();
  const mockSetFilters = jest.fn();

  const sampleConnection: GmailConnectionDto = {
    id: 'conn-1',
    userId: 'user-1',
    googleAccountEmail: 'tester@gmail.com',
    connectionStatus: 'CONNECTED',
    scopes: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly'],
    lastSyncedAt: new Date('2026-11-08T08:00:00Z').toISOString(),
    createdAt: new Date('2026-11-08T07:00:00Z').toISOString(),
    updatedAt: new Date('2026-11-08T08:00:00Z').toISOString(),
  };

  const sampleStats: GmailSyncStatsDto = {
    totalEmails: 12,
    unreadEmails: 3,
    importantEmails: 2,
    requiresReplyCount: 1,
    requiresActionCount: 1,
    lastSyncedAt: new Date('2026-11-08T08:00:00Z').toISOString(),
    syncStatus: 'SUCCESS',
  };

  const sampleEmail: GmailMessageDto = {
    id: 'msg-1',
    userId: 'user-1',
    gmailConnectionId: 'conn-1',
    providerMessageId: 'p-1',
    providerThreadId: 't-1',
    senderName: 'Prof. Davis',
    senderEmail: 'davis@university.edu',
    recipientEmails: ['tester@gmail.com'],
    ccEmails: [],
    subject: 'Course Schedule & Task Deadline',
    snippet: 'Please complete the assigned lab exercise by Friday.',
    bodyText: 'Hello Class,\nPlease complete the assigned lab exercise by Friday 5 PM.',
    receivedAt: new Date('2026-11-08T07:30:00Z').toISOString(),
    isRead: false,
    hasAttachments: false,
    labels: ['INBOX', 'UNREAD'],
    syncStatus: 'SYNCHRONIZED',
    analysis: {
      category: 'EDUCATION',
      priority: 'HIGH',
      urgency: 'TIME_SENSITIVE',
      summary: 'Prof. Davis requests lab exercise submission by Friday 5 PM.',
      requiresReply: false,
      requiresAction: true,
      confidence: 0.95,
    },
    actionItems: [
      {
        id: 'ai-1',
        title: 'Complete assigned lab exercise',
        priority: 'HIGH',
        status: 'PENDING',
      },
    ],
    createdAt: new Date('2026-11-08T07:30:00Z').toISOString(),
    updatedAt: new Date('2026-11-08T07:30:00Z').toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseGmail.mockReturnValue({
      connection: sampleConnection,
      stats: sampleStats,
      messages: [sampleEmail],
      activeMessage: sampleEmail,
      threadMessages: [sampleEmail],
      isLoading: false,
      isSyncing: false,
      isSummarizing: false,
      isGeneratingReply: false,
      isSavingDraft: false,
      isAsking: false,
      error: null,
      filters: {},
      setFilters: mockSetFilters,
      loadConnection: jest.fn(),
      connectGmail: mockConnectGmail,
      disconnectGmail: mockDisconnectGmail,
      triggerSync: mockTriggerSync,
      loadMessages: jest.fn(),
      selectMessage: mockSelectMessage,
      summarizeMessage: mockSummarizeMessage,
      suggestReply: mockSuggestReply,
      createDraft: mockCreateDraft,
      askAboutEmails: mockAskAboutEmails,
    });
  });

  it('should render the Gmail dashboard header and connected account banner', () => {
    render(<GmailDashboardPage />);

    expect(screen.getByText('Gmail Integration')).toBeDefined();
    expect(screen.getAllByText('tester@gmail.com')[0]).toBeDefined();
    expect(screen.getByText('CONNECTED')).toBeDefined();
  });

  it('should render email statistics correctly from database values', () => {
    render(<GmailDashboardPage />);

    expect(screen.getByText('12')).toBeDefined(); // Total Emails
    expect(screen.getByText('3')).toBeDefined(); // Unread
    expect(screen.getByText('2')).toBeDefined(); // Important
    expect(screen.getByText('1')).toBeDefined(); // Action Required
  });

  it('should render synchronized email item in the inbox list', () => {
    render(<GmailDashboardPage />);

    expect(screen.getByText('Prof. Davis')).toBeDefined();
    expect(screen.getAllByText('Course Schedule & Task Deadline')[0]).toBeDefined();
  });

  it('should render active email details in the reading pane', () => {
    render(<GmailDashboardPage />);

    expect(
      screen.getByText('Hello Class, Please complete the assigned lab exercise by Friday 5 PM.'),
    ).toBeDefined();
    expect(
      screen.getByText('Prof. Davis requests lab exercise submission by Friday 5 PM.'),
    ).toBeDefined();
  });

  it('should trigger inbox sync when Sync button is clicked', () => {
    render(<GmailDashboardPage />);

    const syncButton = screen.getByRole('button', { name: /Sync Inbox/i });
    fireEvent.click(syncButton);

    expect(mockTriggerSync).toHaveBeenCalledWith(50);
  });

  it('should switch to Ask BHUVI tab and allow submitting questions', async () => {
    mockAskAboutEmails.mockResolvedValue({
      answer: 'Your latest email is from Prof. Davis regarding the lab deadline.',
      references: [
        {
          id: 'msg-1',
          subject: 'Course Schedule',
          sender: 'davis@university.edu',
          receivedAt: new Date().toISOString(),
        },
      ],
    });

    render(<GmailDashboardPage />);

    const askTab = screen.getByRole('button', { name: /Ask BHUVI/i });
    fireEvent.click(askTab);

    expect(screen.getByText('Ask BHUVI About Your Emails')).toBeDefined();

    const input = screen.getByPlaceholderText(/Which emails require an urgent reply/i);
    fireEvent.change(input, { target: { value: 'Summarize my latest email' } });

    const askBtn = screen.getByRole('button', { name: /^Ask$/i });
    await act(async () => {
      fireEvent.click(askBtn);
    });

    expect(mockAskAboutEmails).toHaveBeenCalledWith('Summarize my latest email');
  });
});
