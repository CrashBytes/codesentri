import { db } from './client.js';

export async function getInstallation(installationId: number) {
  const { rows } = await db.query(
    'SELECT * FROM installations WHERE installation_id = $1',
    [installationId]
  );
  return rows[0] || null;
}

export async function upsertInstallation(installationId: number, accountLogin: string, accountType: string) {
  const { rows } = await db.query(
    `INSERT INTO installations (installation_id, account_login, account_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (installation_id) DO UPDATE SET
       account_login = EXCLUDED.account_login,
       updated_at = NOW()
     RETURNING *`,
    [installationId, accountLogin, accountType]
  );
  return rows[0];
}

export async function incrementUsage(installationId: number) {
  await db.query(
    `UPDATE installations SET reviews_this_month = reviews_this_month + 1, updated_at = NOW()
     WHERE installation_id = $1`,
    [installationId]
  );
}

export async function resetMonthlyUsage() {
  await db.query(
    `UPDATE installations
     SET reviews_this_month = 0,
         month_reset_at = date_trunc('month', NOW()) + INTERVAL '1 month'
     WHERE month_reset_at <= NOW()`
  );
}

export async function getRepoConfig(installationId: number, repo: string) {
  const { rows } = await db.query(
    'SELECT * FROM repo_configs WHERE installation_id = $1 AND repo = $2',
    [installationId, repo]
  );
  return rows[0] || null;
}
