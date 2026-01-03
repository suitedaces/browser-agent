export const API_URL = 'https://api.anthropic.com/v1/messages';
export const API_VERSION = '2023-06-01';
export const BETA_HEADER = 'computer-use-2025-01-24,interleaved-thinking-2025-05-14';

export const MODELS = {
  SONNET: 'claude-sonnet-4-20250514',
  HAIKU: 'claude-haiku-4-5-20251001'
} as const;

export const MAX_TOKENS = 16000;
export const THINKING_BUDGET = 5000;
export const MAX_ITERATIONS = 50;
