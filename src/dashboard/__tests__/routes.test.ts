import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbQuery = vi.fn();
vi.mock('../../db/client.js', () => ({
  db: { query: (...args: any[]) => mockDbQuery(...args) },
}));

const mockCreateCheckoutSession = vi.fn();
vi.mock('../../billing/stripe.js', () => ({
  createCheckoutSession: (...args: any[]) => mockCreateCheckoutSession(...args),
}));

import express from 'express';
import request from 'supertest';
import { dashboardRoutes } from '../routes.js';

function createTestApp() {
  const app = express();
  app.use('/api', express.json(), dashboardRoutes);
  return app;
}

describe('dashboard routes', () => {
  const app = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/installations/:installationId', () => {
    it('returns installation data', async () => {
      const installation = { installation_id: 1, plan: 'pro', reviews_this_month: 10 };
      mockDbQuery.mockResolvedValue({ rows: [installation] });

      const res = await request(app).get('/api/installations/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(installation);
    });

    it('returns 404 when not found', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/installations/999');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Installation not found' });
    });

    it('returns 500 on database error', async () => {
      mockDbQuery.mockRejectedValue(new Error('DB down'));

      const res = await request(app).get('/api/installations/1');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/installations/:installationId/reviews', () => {
    it('returns review history', async () => {
      const reviews = [{ id: 1, repo: 'owner/repo', pr_number: 42 }];
      mockDbQuery.mockResolvedValue({ rows: reviews });

      const res = await request(app).get('/api/installations/1/reviews');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(reviews);
    });

    it('respects limit parameter', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });

      await request(app).get('/api/installations/1/reviews?limit=10');
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        ['1', 10],
      );
    });

    it('caps limit at 100', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });

      await request(app).get('/api/installations/1/reviews?limit=500');
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['1', 100],
      );
    });

    it('defaults limit to 50', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });

      await request(app).get('/api/installations/1/reviews');
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['1', 50],
      );
    });
  });

  describe('POST /api/installations/:installationId/checkout', () => {
    it('returns checkout URL', async () => {
      mockDbQuery.mockResolvedValue({ rows: [{ installation_id: 1, account_login: 'user' }] });
      mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/session');

      const res = await request(app).post('/api/installations/1/checkout');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ url: 'https://checkout.stripe.com/session' });
    });

    it('returns 404 when installation not found', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });

      const res = await request(app).post('/api/installations/999/checkout');
      expect(res.status).toBe(404);
    });

    it('returns 501 when billing not configured', async () => {
      mockDbQuery.mockResolvedValue({ rows: [{ installation_id: 1, account_login: 'user' }] });
      mockCreateCheckoutSession.mockResolvedValue(null);

      const res = await request(app).post('/api/installations/1/checkout');
      expect(res.status).toBe(501);
      expect(res.body).toEqual({ error: 'Billing not configured' });
    });
  });
});
