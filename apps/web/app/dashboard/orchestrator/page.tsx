'use client';

import React, { useState } from 'react';
import { useOrchestrator } from '../../../lib/use-orchestrator';
import { SparklesIcon, PaperAirplaneIcon, ShieldCheckIcon } from '../../../components/ui/icons';

const SUGGESTIONS = [
  "Help me prepare for tomorrow's team sync meeting",
  'Research best practices for API rate limiting and draft a policy note',
  'Organize a task checklist for product launch readiness',
];

export default function OrchestratorPage() {
  const [taskInput, setTaskInput] = useState('');
  const {
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
  } = useOrchestrator();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = taskInput.trim();
    if (!clean || isCreating) return;
    setTaskInput('');
    await createPlan(clean);
  };

  const handleSuggestion = async (text: string) => {
    setTaskInput('');
    await createPlan(text);
  };

  const getAgentColor = (agent: string) => {
    switch (agent) {
      case 'PLANNING':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'RESEARCH':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'COMMUNICATION':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'TASK':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Completed
          </span>
        );
      case 'RUNNING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse">
            Running...
          </span>
        );
      case 'WAITING_FOR_APPROVAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
            Waiting for Approval
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/30">
            Failed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-gray-500/10 text-gray-400 border border-gray-500/30">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-white/5 text-gray-400 border border-white/10">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Title & Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <SparklesIcon className="w-6 h-6 text-bhuvi-400" />
            AI Agent Orchestrator
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Coordinate multi-agent workflows, task decomposition, and human-supervised execution.
          </p>
        </div>
      </div>

      {/* Task Creation Command Form */}
      <div className="rounded-3xl glass-panel p-6 bg-gradient-to-b from-gray-900/90 to-gray-950 border border-white/10 shadow-xl space-y-4">
        <form onSubmit={handleCreate} className="space-y-3">
          <label htmlFor="orchestrator-task" className="block text-xs font-medium text-gray-300">
            Describe a complex task or workflow for BHUVI to plan and execute:
          </label>
          <div className="relative flex items-center">
            <input
              id="orchestrator-task"
              type="text"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              disabled={isCreating}
              placeholder="e.g. Help me prepare for tomorrow's client presentation and draft an email..."
              className="w-full pl-4 pr-12 py-3.5 text-xs sm:text-sm rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-bhuvi-500 focus:border-transparent transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!taskInput.trim() || isCreating}
              className="absolute right-2 p-2 rounded-xl bhuvi-gradient text-white hover:opacity-95 transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
              title="Generate Agent Plan"
              aria-label="Generate Agent Plan"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Suggestions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-mono text-gray-400">Sample Tasks:</span>
            {SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                disabled={isCreating}
                onClick={() => void handleSuggestion(item)}
                className="text-xs px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition disabled:opacity-40"
              >
                {item}
              </button>
            ))}
          </div>
        </form>

        {isCreating && (
          <div className="p-4 rounded-2xl bg-bhuvi-500/10 border border-bhuvi-500/20 text-xs text-bhuvi-300 flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-bhuvi-400 animate-ping" />
            <span>
              Analyzing intent and synthesizing structured execution plan with local model...
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs"
          >
            {error}
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      {isLoading && plans.length === 0 ? (
        <div className="p-12 text-center text-gray-500 text-sm">Loading plans...</div>
      ) : plans.length === 0 ? (
        /* Empty State */
        <div className="rounded-3xl glass-panel p-12 text-center border border-white/5 bg-gray-900/40 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-gray-400">
            <SparklesIcon className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No Orchestration Plans Yet</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            BHUVI breaks complex requests into logical agent roles (Planning, Research,
            Communication, and Task). Enter a task above to begin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Plan History List */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider px-1">
              Generated Plans ({plans.length})
            </h3>
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void selectPlan(p.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition ${
                    activePlan?.id === p.id
                      ? 'bg-bhuvi-500/15 border-bhuvi-500/40 text-white shadow-lg shadow-bhuvi-500/10'
                      : 'bg-white/[0.02] hover:bg-white/5 border-white/5 text-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-semibold line-clamp-1">{p.title}</h4>
                    {getStatusBadge(p.status)}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">{p.prompt}</p>
                  <div className="flex items-center gap-2 mt-2.5 text-[10px] font-mono text-gray-400">
                    <span className="px-1.5 py-0.5 rounded bg-white/5">{p.intentCategory}</span>
                    <span>•</span>
                    <span>{p.steps.length} steps</span>
                    {p.pendingApprovalsCount ? (
                      <span className="text-amber-400 font-bold">
                        ({p.pendingApprovalsCount} approval needed)
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Active Plan Detail & Steps */}
          {activePlan && (
            <div className="lg:col-span-2 space-y-5">
              {/* Active Plan Header */}
              <div className="rounded-3xl glass-panel p-6 bg-gray-900/80 border border-white/10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bhuvi-500/10 text-bhuvi-300 border border-bhuvi-500/30">
                        {activePlan.intentCategory}
                      </span>
                      {getStatusBadge(activePlan.status)}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white mt-1.5">
                      {activePlan.title}
                    </h3>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {activePlan.status !== 'COMPLETED' && activePlan.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        disabled={isExecuting || activePlan.status === 'RUNNING'}
                        onClick={() => void executePlan(activePlan.id)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bhuvi-gradient text-white hover:opacity-95 transition disabled:opacity-50 shadow"
                      >
                        {isExecuting || activePlan.status === 'RUNNING'
                          ? 'Executing...'
                          : 'Execute Plan'}
                      </button>
                    )}

                    {activePlan.status === 'RUNNING' && (
                      <button
                        type="button"
                        onClick={() => void cancelPlan(activePlan.id)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xs text-gray-300 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                  <span className="font-semibold text-gray-400">User Prompt:</span>{' '}
                  {activePlan.prompt}
                </div>

                {activePlan.explanation && (
                  <p className="text-[11px] text-gray-400 italic">
                    Rationale: {activePlan.explanation}
                  </p>
                )}
              </div>

              {/* Pending Approvals Card (if any) */}
              {pendingApprovals.filter((a) => a.planId === activePlan.id).length > 0 && (
                <div className="rounded-3xl p-5 bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                    <ShieldCheckIcon className="w-4 h-4 text-amber-400" />
                    <span>Human Approval Required</span>
                  </div>
                  {pendingApprovals
                    .filter((a) => a.planId === activePlan.id)
                    .map((approval) => (
                      <div
                        key={approval.id}
                        className="p-3.5 rounded-2xl bg-black/40 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="text-white font-medium">{approval.description}</p>
                          <span className="text-[10px] font-mono text-gray-400">
                            Action: {approval.actionType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void approveProposal(approval.id)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-medium transition"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void rejectProposal(approval.id)}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-medium transition"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Steps Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono text-gray-400 uppercase tracking-wider px-1">
                  Plan Steps ({activePlan.steps.length})
                </h4>

                <div className="space-y-3">
                  {activePlan.steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className="rounded-2xl glass-panel p-4.5 bg-gray-900/60 border border-white/5 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[11px] font-mono text-gray-400">
                            {idx + 1}
                          </span>
                          <h5 className="text-sm font-semibold text-white">{step.title}</h5>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono border ${getAgentColor(
                              step.assignedAgent,
                            )}`}
                          >
                            {step.assignedAgent} Agent
                          </span>
                          {getStatusBadge(step.status)}
                        </div>
                      </div>

                      <p className="text-xs text-gray-300 leading-relaxed">{step.description}</p>

                      {step.dependencies.length > 0 && (
                        <div className="text-[10px] font-mono text-gray-400">
                          Prerequisites: {step.dependencies.join(', ')}
                        </div>
                      )}

                      {/* Step Execution Output */}
                      {step.output && (
                        <div className="mt-2.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                          <span className="text-[10px] font-mono text-bhuvi-400 uppercase tracking-wider">
                            Agent Output
                          </span>
                          <div className="text-xs text-gray-200 whitespace-pre-wrap leading-relaxed">
                            {typeof step.output['content'] === 'string'
                              ? step.output['content']
                              : typeof step.output['summary'] === 'string'
                                ? step.output['summary']
                                : JSON.stringify(step.output, null, 2)}
                          </div>
                        </div>
                      )}

                      {step.error && (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                          {step.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
