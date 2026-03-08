import { describe, it, expect, vi } from 'vitest';

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../github/webhooks.js', () => ({
  webhookHandler: vi.fn((_req: any, res: any) => res.json({ ok: true })),
}));

vi.mock('../billing/stripe.js', () => ({
  stripeWebhookHandler: vi.fn((_req: any, res: any) => res.json({ received: true })),
  createCheckoutSession: vi.fn(),
}));

vi.mock('../dashboard/routes.js', () => {
  const { Router } = require('express');
  const router = Router();
  router.get('/test', (_req: any, res: any) => res.json({ test: true }));
  return { dashboardRoutes: router };
});

import { createApp } from '../app.js';
import request from 'supertest';

describe('createApp', () => {
  const app = createApp();

  it('responds to health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('has webhook endpoint', async () => {
    const res = await request(app)
      .post('/api/webhook')
      .send({ test: true })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
  });

  it('has stripe webhook endpoint', async () => {
    const res = await request(app)
      .post('/api/stripe/webhook')
      .send('{}')
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
  });
});
