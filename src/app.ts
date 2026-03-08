import express from 'express';
import { webhookHandler } from './github/webhooks.js';
import { stripeWebhookHandler } from './billing/stripe.js';
import { dashboardRoutes } from './dashboard/routes.js';
import { logger } from './logger.js';

export function createApp() {
  const app = express();

  // Stripe webhook needs raw body
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

  // GitHub webhook
  app.post('/api/webhook', express.json(), webhookHandler);

  // Dashboard API
  app.use('/api', express.json(), dashboardRoutes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
