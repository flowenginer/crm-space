import { create } from 'zustand';

interface ProcessResult {
  processed: number;
  statesIdentified: number;
  tagsCreated: number;
  tagsAssigned: number;
  errors: number;
}

interface StateIdentificationStore {
  isProcessing: boolean;
  progress: number;
  result: ProcessResult | null;
  shouldCancel: boolean;
  contactsWithoutState: number | null;
  // Actions
  startProcessing: () => void;
  updateProgress: (progress: number) => void;
  setResult: (result: ProcessResult | null) => void;
  cancelProcessing: () => void;
  reset: () => void;
  setContactsWithoutState: (count: number | null) => void;
}

export const useStateIdentificationStore = create<StateIdentificationStore>((set) => ({
  isProcessing: false,
  progress: 0,
  result: null,
  shouldCancel: false,
  contactsWithoutState: null,
  startProcessing: () => set({ isProcessing: true, progress: 0, result: null, shouldCancel: false }),
  updateProgress: (progress) => set({ progress }),
  setResult: (result) => set({ result, isProcessing: false, progress: 100 }),
  cancelProcessing: () => set({ shouldCancel: true }),
  reset: () => set({ isProcessing: false, progress: 0, result: null, shouldCancel: false }),
  setContactsWithoutState: (count) => set({ contactsWithoutState: count }),
}));
