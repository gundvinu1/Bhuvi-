'use client';

import React, { useState } from 'react';
import { PaperAirplaneIcon, SparklesIcon } from '../ui/icons';

const SUGGESTIONS = [
  'Summarize my messages',
  "Show today's priorities",
  'What should I focus on today?',
];

export function AssistantPanel() {
  const [prompt, setPrompt] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSelectSuggestion = (suggestion: string) => {
    setPrompt(suggestion);
    setFeedback(
      `Command "${suggestion}" selected. Local AI execution connects in Module 05 (Ollama).`,
    );
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setFeedback(
      `Command "${prompt.trim()}" received. Local AI processing will be activated in Module 05 with Ollama.`,
    );
  };

  return (
    <div className="rounded-3xl glass-panel p-6 sm:p-7 bg-gradient-to-b from-gray-900/90 to-gray-950 border border-bhuvi-500/20 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bhuvi-gradient flex items-center justify-center text-white shadow-lg shadow-bhuvi-500/20">
            <SparklesIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              BHUVI Assistant
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bhuvi-500/10 text-bhuvi-300 border border-bhuvi-500/30">
                Preview
              </span>
            </h3>
            <p className="text-xs text-gray-400">Personal intelligence & local execution agent</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-gray-400 px-3 py-1 rounded-full bg-white/5 border border-white/5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>Ollama integration planned in Module 05</span>
        </div>
      </div>

      {/* Welcome text */}
      <div className="text-xs sm:text-sm text-gray-300 bg-white/[0.02] p-4 rounded-2xl border border-white/5 leading-relaxed">
        I am your local AI companion. Soon I will monitor communications across your connected
        accounts, detect urgent issues, and run authorized tasks locally on your machine.
      </div>

      {/* Interactive Command Form */}
      <form onSubmit={handleSend} className="space-y-3">
        <div className="relative flex items-center">
          <input
            type="text"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              if (feedback) setFeedback(null);
            }}
            placeholder="Ask BHUVI anything or type an instruction..."
            className="w-full pl-4 pr-12 py-3 text-xs sm:text-sm rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-bhuvi-500 focus:border-transparent transition"
          />
          <button
            type="submit"
            disabled={!prompt.trim()}
            className="absolute right-2 p-2 rounded-xl bhuvi-gradient text-white hover:opacity-95 transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
            title="Send command"
            aria-label="Send command"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Informational feedback on interaction */}
        {feedback && (
          <div className="text-xs p-3 rounded-xl bg-bhuvi-500/10 border border-bhuvi-500/20 text-bhuvi-300 flex items-center justify-between">
            <span>{feedback}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-gray-400 hover:text-white text-xs ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-mono text-gray-400">Suggestions:</span>
          {SUGGESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSelectSuggestion(item)}
              className="text-xs px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition"
            >
              {item}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
