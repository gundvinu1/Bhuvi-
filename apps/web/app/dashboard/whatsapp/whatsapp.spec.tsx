import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import WhatsAppDashboardPage from './page';
import { useWhatsApp } from '../../../lib/use-whatsapp';
import { WhatsAppConnectionDto, WhatsAppConversationDto, WhatsAppMessageDto } from '@bhuvi/shared';

jest.mock('../../../lib/use-whatsapp');

const mockUseWhatsApp = useWhatsApp as jest.MockedFunction<typeof useWhatsApp>;

describe('WhatsApp Integration Dashboard Page', () => {
  const mockConnectAccount = jest.fn();
  const mockDisconnectAccount = jest.fn();
  const mockSelectConversation = jest.fn();
  const mockCreateDraft = jest.fn();
  const mockApproveDraft = jest.fn();
  const mockSendDraft = jest.fn();
  const mockSummarizeConversation = jest.fn();
  const mockSuggestReply = jest.fn();
  const mockAskWhatsApp = jest.fn();
  const mockSetFilters = jest.fn();
  const mockSetSelectedConnectionId = jest.fn();
  const mockRefreshConversations = jest.fn();

  const sampleConnection1: WhatsAppConnectionDto = {
    id: 'conn-1',
    userId: 'user-1',
    businessAccountId: 'waba-101',
    phoneNumberId: 'phone-101',
    displayPhoneNumber: '+1 555-0101',
    displayName: 'Customer Support',
    status: 'CONNECTED',
    lastActivityAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleConnection2: WhatsAppConnectionDto = {
    id: 'conn-2',
    userId: 'user-1',
    businessAccountId: 'waba-102',
    phoneNumberId: 'phone-102',
    displayPhoneNumber: '+1 555-0102',
    displayName: 'Emergency Line',
    status: 'CONNECTED',
    lastActivityAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleConversation: WhatsAppConversationDto = {
    id: 'conv-1',
    userId: 'user-1',
    connectionId: 'conn-1',
    contactId: 'contact-1',
    status: 'ACTIVE',
    lastMessageAt: new Date().toISOString(),
    lastMessagePreview: 'Can you please review the urgent lab results?',
    unreadCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contact: {
      id: 'contact-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      waId: '+1234567890',
      name: 'Dr. Jane Watson',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    connection: {
      id: 'conn-1',
      displayPhoneNumber: '+1 555-0101',
      displayName: 'Customer Support',
    },
  };

  const sampleMessage: WhatsAppMessageDto = {
    id: 'msg-1',
    userId: 'user-1',
    connectionId: 'conn-1',
    conversationId: 'conv-1',
    externalMessageId: 'wamid.HBg.1',
    direction: 'INCOMING',
    messageType: 'text',
    textContent: 'Can you please review the urgent lab results?',
    deliveryStatus: 'DELIVERED',
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWhatsApp.mockReturnValue({
      connections: [sampleConnection1, sampleConnection2],
      selectedConnectionId: null,
      setSelectedConnectionId: mockSetSelectedConnectionId,
      connectAccount: mockConnectAccount,
      disconnectAccount: mockDisconnectAccount,
      conversations: [sampleConversation],
      activeConversation: null,
      selectConversation: mockSelectConversation,
      messages: [],
      drafts: [],
      stats: {
        totalConnections: 2,
        activeConversations: 1,
        totalMessages: 15,
        unreadMessages: 1,
        pendingDrafts: 0,
      },
      summary: null,
      replySuggestions: null,
      askResult: null,
      filters: {},
      setFilters: mockSetFilters,
      isLoading: false,
      isSummarizing: false,
      isSuggestingReply: false,
      isSubmittingDraft: false,
      isSending: false,
      isAsking: false,
      error: null,
      createDraft: mockCreateDraft,
      approveDraft: mockApproveDraft,
      sendDraft: mockSendDraft,
      summarizeConversation: mockSummarizeConversation,
      suggestReply: mockSuggestReply,
      askWhatsApp: mockAskWhatsApp,
      refreshConversations: mockRefreshConversations,
    });
  });

  it('renders the WhatsApp dashboard header and statistics', () => {
    render(<WhatsAppDashboardPage />);

    expect(screen.getByText('WhatsApp Business Integration')).toBeDefined();
    expect(screen.getByText('Connected WhatsApp Business Accounts (2)')).toBeDefined();
    expect(screen.getAllByText('+1 555-0101')[0]).toBeDefined();
    expect(screen.getByText('+1 555-0102')).toBeDefined();
  });

  it('displays conversations in unified inbox and triggers selection', () => {
    render(<WhatsAppDashboardPage />);

    const contactName = screen.getByText('Dr. Jane Watson');
    expect(contactName).toBeDefined();

    fireEvent.click(contactName);
    expect(mockSelectConversation).toHaveBeenCalledWith(sampleConversation);
  });

  it('renders active conversation messages and reply composer with human approval notice', () => {
    mockUseWhatsApp.mockReturnValue({
      connections: [sampleConnection1, sampleConnection2],
      selectedConnectionId: null,
      setSelectedConnectionId: mockSetSelectedConnectionId,
      connectAccount: mockConnectAccount,
      disconnectAccount: mockDisconnectAccount,
      conversations: [sampleConversation],
      activeConversation: sampleConversation,
      selectConversation: mockSelectConversation,
      messages: [sampleMessage],
      drafts: [],
      stats: {
        totalConnections: 2,
        activeConversations: 1,
        totalMessages: 15,
        unreadMessages: 1,
        pendingDrafts: 0,
      },
      summary: null,
      replySuggestions: null,
      askResult: null,
      filters: {},
      setFilters: mockSetFilters,
      isLoading: false,
      isSummarizing: false,
      isSuggestingReply: false,
      isSubmittingDraft: false,
      isSending: false,
      isAsking: false,
      error: null,
      createDraft: mockCreateDraft,
      approveDraft: mockApproveDraft,
      sendDraft: mockSendDraft,
      summarizeConversation: mockSummarizeConversation,
      suggestReply: mockSuggestReply,
      askWhatsApp: mockAskWhatsApp,
      refreshConversations: mockRefreshConversations,
    });

    render(<WhatsAppDashboardPage />);

    expect(
      screen.getAllByText('Can you please review the urgent lab results?').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('🔒 Human Approval Enforced')).toBeDefined();
    expect(screen.getByPlaceholderText('Type your WhatsApp reply here…')).toBeDefined();
    expect(screen.getByText('Approve & Send…')).toBeDefined();
  });

  it('opens approval modal when Approve & Send is clicked with content', async () => {
    mockCreateDraft.mockResolvedValue({ id: 'draft-modal-1', approvalStatus: 'PENDING_APPROVAL' });

    mockUseWhatsApp.mockReturnValue({
      connections: [sampleConnection1],
      selectedConnectionId: null,
      setSelectedConnectionId: mockSetSelectedConnectionId,
      connectAccount: mockConnectAccount,
      disconnectAccount: mockDisconnectAccount,
      conversations: [sampleConversation],
      activeConversation: sampleConversation,
      selectConversation: mockSelectConversation,
      messages: [sampleMessage],
      drafts: [],
      stats: null,
      summary: null,
      replySuggestions: null,
      askResult: null,
      filters: {},
      setFilters: mockSetFilters,
      isLoading: false,
      isSummarizing: false,
      isSuggestingReply: false,
      isSubmittingDraft: false,
      isSending: false,
      isAsking: false,
      error: null,
      createDraft: mockCreateDraft,
      approveDraft: mockApproveDraft,
      sendDraft: mockSendDraft,
      summarizeConversation: mockSummarizeConversation,
      suggestReply: mockSuggestReply,
      askWhatsApp: mockAskWhatsApp,
      refreshConversations: mockRefreshConversations,
    });

    render(<WhatsAppDashboardPage />);

    const textarea = screen.getByPlaceholderText('Type your WhatsApp reply here…');
    fireEvent.change(textarea, { target: { value: 'Reviewing now, Dr. Jane!' } });

    const approveBtn = screen.getByText('Approve & Send…');
    await act(async () => {
      fireEvent.click(approveBtn);
    });

    expect(mockCreateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Reviewing now, Dr. Jane!',
      }),
    );
  });
});
