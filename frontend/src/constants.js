export const STATUSES = ['pending', 'running', 'completed', 'failed'];

// Mirrors the backend's state machine. This is purely for UI convenience
// (deciding which action buttons to show) - the backend is the actual
// source of truth and re-validates every transition itself, so this list
// being out of sync would only affect which buttons render, never
// correctness.
export const NEXT_STATUSES = {
  pending: ['running'],
  running: ['completed', 'failed'],
  completed: [],
  failed: [],
};

export const STATUS_LABELS = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};
