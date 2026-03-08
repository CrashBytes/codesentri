import { Request, Response } from 'express';
import { db } from '../db/client.js';
import { logger } from '../logger.js';

interface MarketplacePayload {
  action: string;
  marketplace_purchase: {
    account: {
      id: number;
      login: string;
      type: string;
    };
    plan: {
      id: number;
      name: string;
      monthly_price_in_cents: number;
    };
  };
}

function planFromMarketplace(planName: string): string {
  const normalized = planName.toLowerCase();
  if (normalized.includes('team')) return 'team';
  if (normalized.includes('pro')) return 'pro';
  return 'free';
}

export async function marketplaceWebhookHandler(req: Request, res: Response) {
  const payload = req.body as MarketplacePayload;
  const { action, marketplace_purchase: purchase } = payload;
  const account = purchase.account;
  const plan = planFromMarketplace(purchase.plan.name);

  logger.info({ action, account: account.login, plan, marketplacePlan: purchase.plan.name }, 'Marketplace event');

  switch (action) {
    case 'purchased':
    case 'changed': {
      await db.query(
        `INSERT INTO installations (installation_id, account_login, account_type, plan)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (installation_id) DO UPDATE SET
           plan = EXCLUDED.plan,
           account_login = EXCLUDED.account_login,
           updated_at = NOW()`,
        [account.id, account.login, account.type, plan]
      );
      logger.info({ account: account.login, plan }, 'Plan updated via Marketplace');
      break;
    }

    case 'cancelled': {
      await db.query(
        `UPDATE installations SET plan = 'free', updated_at = NOW()
         WHERE installation_id = $1`,
        [account.id]
      );
      logger.info({ account: account.login }, 'Plan cancelled, reverted to free');
      break;
    }
  }

  res.status(200).json({ ok: true });
}
