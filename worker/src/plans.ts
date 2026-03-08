import type { PlanConfig } from './types.js';

const PLANS: Record<string, PlanConfig> = {
  free: {
    limit: 5,
    model: 'claude-haiku-4-5-20251001',
    maxDiffSize: 30_000,
    maxFiles: 20,
    maxReviewsPerHour: 3,
  },
  pro: {
    limit: 100,
    model: 'claude-sonnet-4-6',
    maxDiffSize: 100_000,
    maxFiles: 100,
    maxReviewsPerHour: 20,
  },
  team: {
    limit: 500,
    model: 'claude-sonnet-4-6',
    maxDiffSize: 100_000,
    maxFiles: 100,
    maxReviewsPerHour: 50,
  },
  enterprise: {
    limit: Infinity,
    model: 'claude-sonnet-4-6',
    maxDiffSize: 100_000,
    maxFiles: 200,
    maxReviewsPerHour: Infinity,
  },
};

const DEFAULT_PLAN = PLANS.free;

export function getPlanConfig(plan: string): PlanConfig {
  return PLANS[plan] ?? DEFAULT_PLAN;
}
