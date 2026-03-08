import type { PlanConfig } from './types.js';
import { getPlanConfig } from './plans.js';

export async function checkUsage(db: D1Database, installationId: number): Promise<PlanConfig | null> {
  // Reset expired monthly counters
  await db.prepare(
    `UPDATE installations
     SET reviews_this_month = 0,
         month_reset_at = strftime('%Y-%m-01', 'now', '+1 month')
     WHERE month_reset_at <= datetime('now')`
  ).run();

  const installation = await db.prepare(
    'SELECT * FROM installations WHERE installation_id = ?'
  ).bind(installationId).first();

  if (!installation) {
    return getPlanConfig('free');
  }

  const planConfig = getPlanConfig(installation.plan as string);

  if ((installation.reviews_this_month as number) >= planConfig.limit) {
    return null;
  }

  // Check hourly rate
  if (planConfig.maxReviewsPerHour !== Infinity) {
    const hourly = await db.prepare(
      `SELECT COUNT(*) as count FROM reviews
       WHERE installation_id = ? AND created_at > datetime('now', '-1 hour')`
    ).bind(installationId).first();

    if (hourly && (hourly.count as number) >= planConfig.maxReviewsPerHour) {
      return null;
    }
  }

  // Increment usage
  await db.prepare(
    `UPDATE installations SET reviews_this_month = reviews_this_month + 1, updated_at = datetime('now')
     WHERE installation_id = ?`
  ).bind(installationId).run();

  return planConfig;
}
