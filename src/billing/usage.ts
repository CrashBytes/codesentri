import { getInstallation, incrementUsage, resetMonthlyUsage } from '../db/queries.js';
import { db } from '../db/client.js';
import { logger } from '../logger.js';

export interface PlanConfig {
  limit: number;
  model: string;
  maxDiffSize: number;
  maxFiles: number;
  maxReviewsPerHour: number;
}

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

async function checkHourlyRate(installationId: number, maxPerHour: number): Promise<boolean> {
  if (maxPerHour === Infinity) return true;

  const { rows } = await db.query(
    `SELECT COUNT(*) as count FROM reviews
     WHERE installation_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [installationId]
  );

  return parseInt(rows[0].count) < maxPerHour;
}

export async function checkUsage(installationId: number): Promise<PlanConfig | null> {
  await resetMonthlyUsage();

  const installation = await getInstallation(installationId);
  if (!installation) {
    logger.info({ installationId }, 'New installation, provisioning free tier');
    return DEFAULT_PLAN;
  }

  const planConfig = getPlanConfig(installation.plan);

  if (installation.reviews_this_month >= planConfig.limit) {
    logger.info({ installationId }, 'Monthly limit reached');
    return null;
  }

  const withinHourlyLimit = await checkHourlyRate(installationId, planConfig.maxReviewsPerHour);
  if (!withinHourlyLimit) {
    logger.info({ installationId }, 'Hourly rate limit reached');
    return null;
  }

  await incrementUsage(installationId);
  return planConfig;
}
