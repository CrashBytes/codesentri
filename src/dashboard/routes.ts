import { Router } from 'express';
import { db } from '../db/client.js';
import { createCheckoutSession } from '../billing/stripe.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/installations/:installationId', async (req, res) => {
  try {
    const { installationId } = req.params;
    const { rows } = await db.query(
      'SELECT * FROM installations WHERE installation_id = $1',
      [installationId]
    );

    if (!rows[0]) {
      res.status(404).json({ error: 'Installation not found' });
      return;
    }

    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

dashboardRoutes.get('/installations/:installationId/reviews', async (req, res) => {
  try {
    const { installationId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const { rows } = await db.query(
      `SELECT * FROM reviews WHERE installation_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [installationId, limit]
    );

    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

dashboardRoutes.post('/installations/:installationId/checkout', async (req, res) => {
  try {
    const installationId = parseInt(req.params.installationId);
    const { rows } = await db.query(
      'SELECT * FROM installations WHERE installation_id = $1',
      [installationId]
    );

    if (!rows[0]) {
      res.status(404).json({ error: 'Installation not found' });
      return;
    }

    const url = await createCheckoutSession(installationId, rows[0].account_login);
    if (!url) {
      res.status(501).json({ error: 'Billing not configured' });
      return;
    }

    res.json({ url });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
