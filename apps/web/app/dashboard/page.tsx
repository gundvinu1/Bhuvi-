'use client';

import React from 'react';
import { WelcomeSection } from '../../components/dashboard/welcome-section';
import { StatCardsGrid } from '../../components/dashboard/stat-card';
import { AssistantPanel } from '../../components/dashboard/assistant-panel';
import { RecentActivity } from '../../components/dashboard/recent-activity';
import { DailyIntelligence } from '../../components/dashboard/daily-intelligence';

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-6">
      {/* 1. Personalized Welcome Section */}
      <WelcomeSection />

      {/* 2. Four Statistics Cards with honest placeholders */}
      <section aria-label="System Statistics">
        <StatCardsGrid />
      </section>

      {/* 3. Prominent AI Assistant Card */}
      <section aria-label="AI Assistant Command Center">
        <AssistantPanel />
      </section>

      {/* 4. Activity & Intelligence Panels */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-label="Live Insights">
        <RecentActivity />
        <DailyIntelligence />
      </section>
    </div>
  );
}
