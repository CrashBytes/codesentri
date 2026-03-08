export interface Env {
  DB: D1Database;
  GITHUB_APP_ID: string;
  GITHUB_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  ANTHROPIC_API_KEY: string;
  GA4_MEASUREMENT_ID: string;
  GA4_API_SECRET: string;
}

export interface ReviewComment {
  path: string;
  line: number;
  severity: 'critical' | 'warning' | 'suggestion' | 'nitpick';
  title: string;
  message: string;
  suggestion?: string;
}

export interface PlanConfig {
  limit: number;
  model: string;
  maxDiffSize: number;
  maxFiles: number;
  maxReviewsPerHour: number;
}
