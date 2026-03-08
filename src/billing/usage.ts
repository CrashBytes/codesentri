import { getInstallation, incrementUsage, resetMonthlyUsage } from '../db/queries.js';
import { logger } from '../logger.js';

const PLAN_LIMITS: Record<string, number> = {
  free: 20,
  pro: 500,
  enterprise: Infinity,
};

export async function checkUsage(installationId: number): Promise<boolean> {
  await resetMonthlyUsage();

  const installation = await getInstallation(installationId);
  if (!installation) {
    logger.info({ installationId }, 'New installation, provisioning free tier');
    return true;
  }

  const limit = PLAN_LIMITS[installation.plan] ?? PLAN_LIMITS.free;

  if (installation.reviews_this_month >= limit) {
    return false;
  }

  await incrementUsage(installationId);
  return true;
}
