'use client';

import { useState, useEffect, useCallback } from 'react';
import { AgentPlanDto, ExecutePlanResponse, ApprovalRequestDto } from '@bhuvi/shared';
import { apiFetch } from './api';

export interface UseOrchestratorReturn {
  plans: AgentPlanDto[];
  activePlan: AgentPlanDto | null;
  pendingApprovals: ApprovalRequestDto[];
  isLoading: boolean;
  isCreating: boolean;
  isExecuting: boolean;
  error: string | null;
  createPlan: (message: string) => Promise<AgentPlanDto | null>;
  executePlan: (planId: string) => Promise<void>;
  cancelPlan: (planId: string) => Promise<void>;
  approveProposal: (approvalId: string, reason?: string) => Promise<void>;
  rejectProposal: (approvalId: string, reason?: string) => Promise<void>;
  selectPlan: (planId: string) => Promise<void>;
  refreshPlans: () => Promise<void>;
}

export function useOrchestrator(): UseOrchestratorReturn {
  const [plans, setPlans] = useState<AgentPlanDto[]>([]);
  const [activePlan, setActivePlan] = useState<AgentPlanDto | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequestDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const [plansRes, approvalsRes] = await Promise.all([
        apiFetch<AgentPlanDto[]>('/orchestrator/plans'),
        apiFetch<ApprovalRequestDto[]>('/orchestrator/approvals').catch(() => ({ data: [] })),
      ]);

      if (plansRes && plansRes.data) {
        setPlans(plansRes.data);
        if (plansRes.data.length > 0 && !activePlan) {
          setActivePlan(plansRes.data[0] || null);
        }
      }

      if (approvalsRes && approvalsRes.data) {
        setPendingApprovals(approvalsRes.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch orchestrator data';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activePlan]);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  const selectPlan = useCallback(async (planId: string) => {
    try {
      const res = await apiFetch<AgentPlanDto>(`/orchestrator/plans/${planId}`);
      if (res && res.data) {
        setActivePlan(res.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load plan details');
    }
  }, []);

  const createPlan = useCallback(async (message: string): Promise<AgentPlanDto | null> => {
    const cleanMessage = message.trim();
    if (!cleanMessage) return null;

    setIsCreating(true);
    setError(null);

    try {
      const res = await apiFetch<AgentPlanDto>('/orchestrator/plans', {
        method: 'POST',
        body: JSON.stringify({ message: cleanMessage }),
      });

      if (res && res.data) {
        setPlans((prev) => [res.data, ...prev]);
        setActivePlan(res.data);
        return res.data;
      }
      return null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create plan';
      setError(msg);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const executePlan = useCallback(
    async (planId: string) => {
      setIsExecuting(true);
      setError(null);

      try {
        await apiFetch<ExecutePlanResponse>(`/orchestrator/plans/${planId}/execute`, {
          method: 'POST',
        });

        await selectPlan(planId);
        await fetchPlans();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Execution failed';
        setError(msg);
      } finally {
        setIsExecuting(false);
      }
    },
    [selectPlan, fetchPlans],
  );

  const cancelPlan = useCallback(
    async (planId: string) => {
      setError(null);
      try {
        await apiFetch<{ message: string }>(`/orchestrator/plans/${planId}/cancel`, {
          method: 'POST',
        });
        await selectPlan(planId);
        await fetchPlans();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to cancel plan');
      }
    },
    [selectPlan, fetchPlans],
  );

  const approveProposal = useCallback(
    async (approvalId: string, reason?: string) => {
      setError(null);
      try {
        await apiFetch<ApprovalRequestDto>(`/orchestrator/approvals/${approvalId}/approve`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
        if (activePlan) {
          await selectPlan(activePlan.id);
        }
        await fetchPlans();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to approve proposal');
      }
    },
    [activePlan, selectPlan, fetchPlans],
  );

  const rejectProposal = useCallback(
    async (approvalId: string, reason?: string) => {
      setError(null);
      try {
        await apiFetch<ApprovalRequestDto>(`/orchestrator/approvals/${approvalId}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
        if (activePlan) {
          await selectPlan(activePlan.id);
        }
        await fetchPlans();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to reject proposal');
      }
    },
    [activePlan, selectPlan, fetchPlans],
  );

  return {
    plans,
    activePlan,
    pendingApprovals,
    isLoading,
    isCreating,
    isExecuting,
    error,
    createPlan,
    executePlan,
    cancelPlan,
    approveProposal,
    rejectProposal,
    selectPlan,
    refreshPlans: fetchPlans,
  };
}
