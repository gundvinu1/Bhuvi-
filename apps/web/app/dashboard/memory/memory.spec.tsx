import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MemoryDashboardPage from './page';
import { useMemory } from '../../../lib/use-memory';
import { MemoryDto, MemoryStatsDto } from '@bhuvi/shared';

jest.mock('../../../lib/use-memory');

const mockUseMemory = useMemory as jest.MockedFunction<typeof useMemory>;

describe('Memory & Knowledge Dashboard Page', () => {
  const mockCreateMemory = jest.fn();
  const mockUpdateMemory = jest.fn();
  const mockDeleteMemory = jest.fn();
  const mockReprocessMemory = jest.fn();
  const mockSelectMemory = jest.fn();
  const mockSearchMemories = jest.fn();
  const mockAskQuestion = jest.fn();
  const mockClearAskResult = jest.fn();
  const mockClearSearchResults = jest.fn();
  const mockRefresh = jest.fn();
  const mockSetFilters = jest.fn();

  const sampleStats: MemoryStatsDto = {
    totalMemories: 8,
    completedMemories: 7,
    pendingMemories: 1,
    failedMemories: 0,
    totalChunks: 24,
    categoryDistribution: {
      PERSONAL: 2,
      PROJECT: 3,
      EDUCATION: 1,
      WORK: 2,
      BUSINESS: 0,
      IMPORTANT_EVENTS: 0,
      NOTES: 0,
      CONVERSATION: 0,
    },
  };

  const sampleMemory: MemoryDto = {
    id: 'mem-101',
    userId: 'usr-1',
    title: 'Home WiFi Network Details',
    content: 'SSID is HomeNet-5G and password is MoonLight#9921.',
    category: 'PERSONAL',
    importance: 'HIGH',
    source: 'USER_MANUAL',
    status: 'COMPLETED',
    createdAt: '2026-11-08T07:00:00.000Z',
    updatedAt: '2026-11-08T07:00:00.000Z',
    tags: ['wifi', 'home'],
    chunksCount: 1,
    chunks: [
      {
        id: 'chk-1',
        memoryId: 'mem-101',
        chunkIndex: 0,
        content: 'SSID is HomeNet-5G and password is MoonLight#9921.',
        tokenCount: 10,
        dimensions: 768,
        modelName: 'nomic-embed-text',
        createdAt: '2026-11-08T07:00:00.000Z',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMemory.mockReturnValue({
      memories: [sampleMemory],
      activeMemory: sampleMemory,
      stats: sampleStats,
      searchResults: [],
      askResult: null,
      isLoading: false,
      isSearching: false,
      isAsking: false,
      isSaving: false,
      error: null,
      filters: {},
      setFilters: mockSetFilters,
      createMemory: mockCreateMemory,
      updateMemory: mockUpdateMemory,
      deleteMemory: mockDeleteMemory,
      reprocessMemory: mockReprocessMemory,
      selectMemory: mockSelectMemory,
      searchMemories: mockSearchMemories,
      askQuestion: mockAskQuestion,
      clearAskResult: mockClearAskResult,
      clearSearchResults: mockClearSearchResults,
      refresh: mockRefresh,
    });
  });

  it('renders header, stats cards, and tab buttons', () => {
    render(<MemoryDashboardPage />);

    expect(screen.getByText('Personal Memory & Knowledge System')).toBeDefined();
    expect(screen.getByText('8')).toBeDefined(); // total memories
    expect(screen.getByText('24')).toBeDefined(); // total chunks
    expect(screen.getByText('Knowledge Base (1)')).toBeDefined();
    expect(screen.getByText('Vector Search')).toBeDefined();
    expect(screen.getByText('Ask BHUVI (RAG)')).toBeDefined();
  });

  it('renders memory card and detailed view', () => {
    render(<MemoryDashboardPage />);

    expect(screen.getAllByText('Home WiFi Network Details').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/SSID is HomeNet-5G/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('#wifi')).toBeDefined();
    expect(screen.getByText(/768-dim/)).toBeDefined();
  });

  it('opens and submits Add Memory modal', async () => {
    mockCreateMemory.mockResolvedValueOnce({
      ...sampleMemory,
      id: 'mem-102',
      title: 'New Memory Title',
    });

    render(<MemoryDashboardPage />);

    const addBtn = screen.getByText('+ Add Memory');
    fireEvent.click(addBtn);

    expect(screen.getByText('Create New Personal Memory')).toBeDefined();

    const titleInput = screen.getByPlaceholderText(/Home WiFi Details/);
    const contentInput = screen.getByPlaceholderText(/Detailed memory content/);

    fireEvent.change(titleInput, { target: { value: 'New Test Note' } });
    fireEvent.change(contentInput, { target: { value: 'Note content for vectorization' } });

    const submitBtn = screen.getByText('Create & Index');
    fireEvent.click(submitBtn);

    expect(mockCreateMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Test Note',
        content: 'Note content for vectorization',
      }),
    );
  });

  it('switches to Vector Search tab and performs search', () => {
    render(<MemoryDashboardPage />);

    const searchTab = screen.getByText('Vector Search');
    fireEvent.click(searchTab);

    expect(screen.getByText('Dense Vector Cosine Similarity Search')).toBeDefined();

    const input = screen.getByPlaceholderText(/Enter natural language query/);
    fireEvent.change(input, { target: { value: 'WiFi password' } });

    const submitBtn = screen.getByText('Semantic Search');
    fireEvent.click(submitBtn);

    expect(mockSearchMemories).toHaveBeenCalledWith('WiFi password', expect.any(Object));
  });

  it('switches to Ask BHUVI (RAG) tab and submits question', () => {
    render(<MemoryDashboardPage />);

    const askTab = screen.getByText('Ask BHUVI (RAG)');
    fireEvent.click(askTab);

    expect(screen.getByText('Ask BHUVI (Personal Knowledge RAG)')).toBeDefined();

    const input = screen.getByPlaceholderText(/Ask anything about your stored knowledge/);
    fireEvent.change(input, { target: { value: 'What is my home WiFi password?' } });

    const askBtn = screen.getByText('Ask BHUVI');
    fireEvent.click(askBtn);

    expect(mockAskQuestion).toHaveBeenCalledWith('What is my home WiFi password?');
  });
});
