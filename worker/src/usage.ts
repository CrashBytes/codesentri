import type { PlanConfig } from './types.js';
import { getPlanConfig } from './plans.js';

/**
 * Check usage limits and return plan config if review is allowed.
 * Returns null if the installation has exceeded its limits.
 *
 * IMPORTANT: If no DB row exists for the installation, we create one
 * (defaulting to 'free' plan) to ensure usage is always tracked.
 */
export async function checkUsage(db: D1Database, installationId: number): Promise<PlanConfig | null> {
  // Reset expired monthly counters
  await db.prepare(
    `UPDATE installations
     SET reviews_this_month = 0,
         month_reset_at = strftime('%Y-%m-01', 'now', '+1 month')
     WHERE month_reset_at <= datetime('now')`
  ).run();

  let installation = await db.prepare(
    'SELECT * FROM installations WHERE installation_id = ?'
  ).bind(installationId).first();

  // If no DB row exists, create one so usage is tracked from the start
  if (!installation) {
    await db.prepare(
      `INSERT INTO installations (installation_id, account_login, account_type, plan, reviews_this_month)
       VALUES (?, 'unknown', 'User', 'free', 0)
       ON CONFLICT (installation_id) DO NOTHING`
    ).bind(installationId).run();

    installation = await db.prepare(
      'SELECT * FROM installations WHERE installation_id = ?'
    ).bind(installationId).first();

    if (!installation) {
      console.error(`Failed to create installation record for ${installationId}`);
      return null; // Fail closed — don't allow review without tracking
    }
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

  // Increment usage AFTER all checks pass (not before review runs)
  const result = await db.prepare(
    `UPDATE installations SET reviews_this_month = reviews_this_month + 1, updated_at = datetime('now')
     WHERE installation_id = ?`
  ).bind(installationId).run();

  // Fail closed: if UPDATE affected 0 rows, the row disappeared between SELECT and UPDATE
  if (!result.meta?.changes || result.meta.changes === 0) {
    console.error(`Usage increment failed for installation ${installationId} — 0 rows updated`);
    return null;
  }

  return planConfig;
}
