import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockDbQuery = vi.fn();
vi.mock('../../db/client.js', () => ({
  db: { query: (...args: any[]) => mockDbQuery(...args) },
}));

const mockConstructEvent = vi.fn();
const mockCheckoutCreate = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: { constructEvent: (...args: any[]) => mockConstructEvent(...args) },
    checkout: { sessions: { create: (...args: any[]) => mockCheckoutCreate(...args) } },
  })),
}));

vi.mock('../../config.js', () => ({
  config: {
    stripe: {
      secretKey: 'sk_test_123',
      webhookSecret: 'whsec_test',
      priceIdPro: 'price_pro',
    },
  },
}));

import { stripeWebhookHandler, createCheckoutSession } from '../stripe.js';

function mockReq(body: any = {}, headers: Record<string, string> = {}) {
  return {
    body,
    headers: { 'stripe-signature': 'sig_test', ...headers },
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('stripeWebhookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles subscription created event', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          customer: 'cus_123',
          id: 'sub_123',
          status: 'active',
        },
      },
    });
    mockDbQuery.mockResolvedValue({ rows: [] });

    const res = mockRes();
    await stripeWebhookHandler(mockReq(), res);

    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE installations SET plan'),
      ['pro', 'sub_123', 'cus_123'],
    );
  });

  it('handles subscription updated to inactive', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_123',
          id: 'sub_123',
          status: 'past_due',
        },
      },
    });
    mockDbQuery.mockResolvedValue({ rows: [] });

    const res = mockRes();
    await stripeWebhookHandler(mockReq(), res);

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE installations SET plan'),
      ['free', 'sub_123', 'cus_123'],
    );
  });

  it('handles subscription deleted event', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          customer: 'cus_456',
          id: 'sub_456',
        },
      },
    });
    mockDbQuery.mockResolvedValue({ rows: [] });

    const res = mockRes();
    await stripeWebhookHandler(mockReq(), res);

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("plan = 'free'"),
      ['cus_456'],
    );
  });

  it('returns 400 on invalid signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const res = mockRes();
    await stripeWebhookHandler(mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
  });
});

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates checkout session and returns URL', async () => {
    mockCheckoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay' });

    const url = await createCheckoutSession(1, 'user');
    expect(url).toBe('https://checkout.stripe.com/pay');
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        metadata: { installationId: '1', accountLogin: 'user' },
      }),
    );
  });
});
