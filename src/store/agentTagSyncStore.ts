import { create } from 'zustand';

interface SyncResult {
  contactId: string;
  contactName: string;
  contactPhone: string;
  action: string;
  tagName?: string;
  agentName?: string;
  success: boolean;
  error?: string;
}

interface SyncSummary {
  total: number;
  processed: number;
  successful: number;
  errors: number;
  results: SyncResult[];
}

interface AgentTagSyncStore {
  isProcessing: boolean;
  progress: number;
  summary: SyncSummary | null;
  shouldCancel: boolean;
  // Actions
  startProcessing: () => void;
  updateProgress: (progress: number) => void;
  setSummary: (summary: SyncSummary | null) => void;
  cancelProcessing: () => void;
  reset: () => void;
}

export const useAgentTagSyncStore = create<AgentTagSyncStore>((set) => ({
  isProcessing: false,
  progress: 0,
  summary: null,
  shouldCancel: false,
  startProcessing: () => set({ isProcessing: true, progress: 0, summary: null, shouldCancel: false }),
  updateProgress: (progress) => set({ progress }),
  setSummary: (summary) => set({ summary, isProcessing: false, progress: 100 }),
  cancelProcessing: () => set({ shouldCancel: true }),
  reset: () => set({ isProcessing: false, progress: 0, summary: null, shouldCancel: false }),
}));
