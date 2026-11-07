import { IntentCategory, AgentRole, IntentAnalysisResult } from '@bhuvi/shared';

export { IntentCategory, AgentRole, IntentAnalysisResult };

export interface RawIntentModelOutput {
  intent?: string;
  explanation?: string;
  confidence?: number;
  selectedAgents?: string[];
  clarificationNeeded?: boolean;
  clarificationPrompt?: string;
}
