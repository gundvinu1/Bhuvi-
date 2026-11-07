'use client';

import React, { useState } from 'react';
import { useAi } from '../../lib/use-ai';
import { PaperAirplaneIcon, SparklesIcon } from '../ui/icons';

const SUGGESTIONS = [
  'Explain what artificial intelligence is in simple English',
  'What should I focus on today?',
  'Summarize the core benefits of a local-first AI operating system',
];

export function AssistantPanel() {
  const [message, setMessage] = useState('');
  const {
    status,
    isStatusLoading,
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    refreshStatus,
  } = useAi();

  const handleSelectSuggestion = async (suggestion: string) => {
    setMessage('');
    await sendMessage(suggestion);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMessage = message.trim();
    if (!cleanMessage || isLoading) return;
    setMessage('');
    await sendMessage(cleanMessage);
  };

  const getStatusBadge = () => {
    if (isStatusLoading) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-mono text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span>Probing Ollama...</span>
        </span>
      );
    }

    if (status?.status === 'connected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Ollama: Connected ({status.model})</span>
        </span>
      );
    }

    if (status?.status === 'degraded') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>Model Missing: {status.model}</span>
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={() => void refreshStatus()}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[11px] font-mono text-rose-400 hover:bg-rose-500/20 transition"
        title="Ollama is offline. Click to retry connection."
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        <span>Ollama: Offline (Click to retry)</span>
      </button>
    );
  };

  const formatDuration = (ms?: number) => {
    if (ms === undefined) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="rounded-3xl glass-panel p-6 sm:p-7 bg-gradient-to-b from-gray-900/90 to-gray-950 border border-bhuvi-500/20 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bhuvi-gradient flex items-center justify-center text-white shadow-lg shadow-bhuvi-500/20">
            <SparklesIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              BHUVI Assistant
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bhuvi-500/10 text-bhuvi-300 border border-bhuvi-500/30">
                Local AI Engine
              </span>
            </h3>
            <p className="text-xs text-gray-400">
              Private local intelligence running on Ollama ({status?.model || 'qwen2.5:3b'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {getStatusBadge()}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              className="px-2.5 py-1 text-[11px] font-mono text-gray-400 hover:text-gray-200 bg-white/5 hover:bg-white/10 rounded-full transition"
              title="Clear visible conversation"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages Stream or Welcome Greeting */}
      {messages.length === 0 ? (
        <div className="text-xs sm:text-sm text-gray-300 bg-white/[0.02] p-4 rounded-2xl border border-white/5 leading-relaxed space-y-2">
          <p>
            Hello! I am <span className="font-semibold text-bhuvi-300">BHUVI</span>, your local
            artificial intelligence companion. You can ask me questions, request explanations, or
            brainstorm ideas.
          </p>
          <p className="text-[11px] text-gray-400">
            ⚡ All model inference executes 100% locally on your machine via Ollama. No private data
            is ever sent to external cloud APIs.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-bhuvi-600/30 border border-bhuvi-500/40 text-white rounded-br-none'
                    : 'bg-white/5 border border-white/10 text-gray-200 rounded-bl-none'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/5 text-[10px] font-mono text-bhuvi-300">
                    <span className="font-semibold">BHUVI</span>
                    {msg.durationMs !== undefined && (
                      <span className="text-gray-400">{formatDuration(msg.durationMs)}</span>
                    )}
                  </div>
                )}
                {msg.content}
              </div>
            </div>
          ))}

          {/* Thinking / Loading indicator */}
          {isLoading && (
            <div className="flex flex-col items-start">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-bhuvi-300 rounded-bl-none flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-bhuvi-400 animate-ping" />
                <span>BHUVI is thinking...</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between"
        >
          <span>{error}</span>
        </div>
      )}

      {/* Interactive Command Form */}
      <form onSubmit={handleSend} className="space-y-3">
        <div className="relative flex items-center">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isLoading}
            placeholder={
              status?.status === 'unavailable'
                ? 'Ollama is offline. Start Ollama to chat...'
                : 'Ask BHUVI anything or type an instruction... (Press Enter to send)'
            }
            className="w-full pl-4 pr-12 py-3 text-xs sm:text-sm rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-bhuvi-500 focus:border-transparent transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!message.trim() || isLoading || status?.status === 'unavailable'}
            className="absolute right-2 p-2 rounded-xl bhuvi-gradient text-white hover:opacity-95 transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
            title="Send message to BHUVI"
            aria-label="Send message to BHUVI"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-mono text-gray-400">Suggestions:</span>
          {SUGGESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              disabled={isLoading || status?.status === 'unavailable'}
              onClick={() => void handleSelectSuggestion(item)}
              className="text-xs px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {item}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
