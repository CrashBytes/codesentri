import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockDbQuery = vi.fn();
vi.mock('../../db/client.js', () => ({
  db: { query: (...args: any[]) => mockDbQuery(...args) },
}));

import { marketplaceWebhookHandler } from '../marketplace.js';

function mockReq(body: any) {
  return { body } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function makePayload(action: string, planName: string) {
  return {
    action,
    marketplace_purchase: {
      account: { id: 100, login: 'testuser', type: 'User' },
      plan: { id: 1, name: planName, monthly_price_in_cents: 1900 },
    },
  };
}

describe('marketplaceWebhookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQuery.mockResolvedValue({ rows: [] });
  });

  it('handles purchased event with pro plan', async () => {
    const res = mockRes();
    await marketplaceWebhookHandler(mockReq(makePayload('purchased', 'Pro Plan')), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO installations'),
      [100, 'testuser', 'User', 'pro'],
    );
  });

  it('handles purchased event with team plan', async () => {
    const res = mockRes();
    await marketplaceWebhookHandler(mockReq(makePayload('purchased', 'Team Plan')), res);

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO installations'),
      [100, 'testuser', 'User', 'team'],
    );
  });

  it('handles changed event', async () => {
    const res = mockRes();
    await marketplaceWebhookHandler(mockReq(makePayload('changed', 'Pro Plan')), res);

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      [100, 'testuser', 'User', 'pro'],
    );
  });

  it('handles cancelled event', async () => {
    const res = mockRes();
    await marketplaceWebhookHandler(mockReq(makePayload('cancelled', 'Pro Plan')), res);

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("plan = 'free'"),
      [100],
    );
  });

  it('defaults to free plan for unknown plan name', async () => {
    const res = mockRes();
    await marketplaceWebhookHandler(mockReq(makePayload('purchased', 'Unknown Plan')), res);

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO installations'),
      [100, 'testuser', 'User', 'free'],
    );
  });

  it('ignores unrecognized actions', async () => {
    const res = mockRes();
    await marketplaceWebhookHandler(mockReq(makePayload('pending_change', 'Pro Plan')), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockDbQuery).not.toHaveBeenCalled();
  });
});
