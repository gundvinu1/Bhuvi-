import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OrchestratorPage from './page';
import { useOrchestrator } from '../../../lib/use-orchestrator';
import { useAuth } from '../../../lib/auth-context';

jest.mock('../../../lib/use-orchestrator');
jest.mock('../../../lib/auth-context');

const mockUseOrchestrator = useOrchestrator as jest.MockedFunction<typeof useOrchestrator>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('AI Orchestrator Dashboard Page', () => {
  const mockCreatePlan = jest.fn();
  const mockExecutePlan = jest.fn();
  const mockCancelPlan = jest.fn();
  const mockApproveProposal = jest.fn();
  const mockRejectProposal = jest.fn();
  const mockSelectPlan = jest.fn();
  const mockRefreshPlans = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: {
        id: 'usr-1',
        name: 'Vinayak Gund',
        email: 'vinayak@example.com',
        createdAt: '2026-11-07',
        updatedAt: '2026-11-07',
      },
      isLoading: false,
      isAuthenticated: true,
      error: null,
      logout: jest.fn(),
      refreshUser: jest.fn(),
    });

    mockUseOrchestrator.mockReturnValue({
      plans: [],
      activePlan: null,
      pendingApprovals: [],
      isLoading: false,
      isCreating: false,
      isExecuting: false,
      error: null,
      createPlan: mockCreatePlan,
      executePlan: mockExecutePlan,
      cancelPlan: mockCancelPlan,
      approveProposal: mockApproveProposal,
      rejectProposal: mockRejectProposal,
      selectPlan: mockSelectPlan,
      refreshPlans: mockRefreshPlans,
    });
  });

  it('renders Orchestrator header and empty state when no plans exist', () => {
    render(<OrchestratorPage />);

    expect(screen.getByText('AI Agent Orchestrator')).toBeDefined();
    expect(screen.getByText('No Orchestration Plans Yet')).toBeDefined();
    expect(
      screen.getByPlaceholderText(/Help me prepare for tomorrow's client presentation/i),
    ).toBeDefined();
  });

  it('submits a new task description on form submit', () => {
    render(<OrchestratorPage />);

    const input = screen.getByPlaceholderText(
      /Help me prepare for tomorrow's client presentation/i,
    );
    fireEvent.change(input, { target: { value: 'Plan tomorrow product launch' } });

    const submitBtn = screen.getByRole('button', { name: /Generate Agent Plan/i });
    fireEvent.click(submitBtn);

    expect(mockCreatePlan).toHaveBeenCalledWith('Plan tomorrow product launch');
  });

  it('renders active plan with step timeline and agent assignments', () => {
    mockUseOrchestrator.mockReturnValue({
      plans: [
        {
          id: 'plan-1',
          userId: 'usr-1',
          title: 'Meeting Prep Plan',
          prompt: 'Prepare for meeting',
          intentCategory: 'PLANNING',
          status: 'PENDING',
          clarificationNeeded: false,
          explanation: 'Planning intent',
          steps: [
            {
              id: 's-1',
              stepKey: 'step-1',
              stepIndex: 1,
              title: 'Identify Meeting Goals',
              description: 'Outline goals',
              assignedAgent: 'PLANNING',
              dependencies: [],
              status: 'COMPLETED',
              requiresApproval: false,
            },
            {
              id: 's-2',
              stepKey: 'step-2',
              stepIndex: 2,
              title: 'Draft Agenda Email',
              description: 'Prepare email draft',
              assignedAgent: 'COMMUNICATION',
              dependencies: ['step-1'],
              status: 'WAITING_FOR_APPROVAL',
              requiresApproval: true,
            },
          ],
          createdAt: '2026-11-07',
          updatedAt: '2026-11-07',
        },
      ],
      activePlan: {
        id: 'plan-1',
        userId: 'usr-1',
        title: 'Meeting Prep Plan',
        prompt: 'Prepare for meeting',
        intentCategory: 'PLANNING',
        status: 'PENDING',
        clarificationNeeded: false,
        explanation: 'Planning intent',
        steps: [
          {
            id: 's-1',
            stepKey: 'step-1',
            stepIndex: 1,
            title: 'Identify Meeting Goals',
            description: 'Outline goals',
            assignedAgent: 'PLANNING',
            dependencies: [],
            status: 'COMPLETED',
            requiresApproval: false,
          },
          {
            id: 's-2',
            stepKey: 'step-2',
            stepIndex: 2,
            title: 'Draft Agenda Email',
            description: 'Prepare email draft',
            assignedAgent: 'COMMUNICATION',
            dependencies: ['step-1'],
            status: 'WAITING_FOR_APPROVAL',
            requiresApproval: true,
          },
        ],
        createdAt: '2026-11-07',
        updatedAt: '2026-11-07',
      },
      pendingApprovals: [
        {
          id: 'appr-1',
          planId: 'plan-1',
          stepId: 's-2',
          userId: 'usr-1',
          actionType: 'PROPOSAL_MESSAGE_DRAFT',
          description: 'Draft agenda email ready for review',
          proposalData: { draft: 'Hello team...' },
          status: 'PENDING',
          createdAt: '2026-11-07',
        },
      ],
      isLoading: false,
      isCreating: false,
      isExecuting: false,
      error: null,
      createPlan: mockCreatePlan,
      executePlan: mockExecutePlan,
      cancelPlan: mockCancelPlan,
      approveProposal: mockApproveProposal,
      rejectProposal: mockRejectProposal,
      selectPlan: mockSelectPlan,
      refreshPlans: mockRefreshPlans,
    });

    render(<OrchestratorPage />);

    expect(screen.getAllByText('Meeting Prep Plan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Identify Meeting Goals')).toBeDefined();
    expect(screen.getByText('PLANNING Agent')).toBeDefined();
    expect(screen.getByText('Draft Agenda Email')).toBeDefined();
    expect(screen.getByText('COMMUNICATION Agent')).toBeDefined();
    expect(screen.getByText('Human Approval Required')).toBeDefined();
    expect(screen.getByRole('button', { name: /Approve/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Reject/i })).toBeDefined();
  });
});
