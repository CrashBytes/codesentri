import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockHandlePullRequest = vi.fn();
vi.mock('../handlers.js', () => ({
  handlePullRequest: (...args: any[]) => mockHandlePullRequest(...args),
}));

const mockVerifyAndReceive = vi.fn();
vi.mock('@octokit/webhooks', () => ({
  Webhooks: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    verifyAndReceive: (...args: any[]) => mockVerifyAndReceive(...args),
  })),
}));

vi.mock('../../config.js', () => ({
  config: {
    github: { appId: '1', privateKey: 'key', webhookSecret: 'secret' },
  },
}));

import { webhookHandler } from '../webhooks.js';

function mockReq(headers: Record<string, string> = {}, body: any = {}) {
  return {
    headers: {
      'x-github-delivery': 'delivery-id',
      'x-github-event': 'pull_request',
      'x-hub-signature-256': 'sha256=abc',
      ...headers,
    },
    body,
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('webhookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 on successful verification', async () => {
    mockVerifyAndReceive.mockResolvedValue(undefined);
    const req = mockReq();
    const res = mockRes();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('passes correct params to verifyAndReceive', async () => {
    mockVerifyAndReceive.mockResolvedValue(undefined);
    const body = { action: 'opened' };
    const req = mockReq({}, body);
    const res = mockRes();

    await webhookHandler(req, res);

    expect(mockVerifyAndReceive).toHaveBeenCalledWith({
      id: 'delivery-id',
      name: 'pull_request',
      payload: JSON.stringify(body),
      signature: 'sha256=abc',
    });
  });

  it('returns 400 on verification failure', async () => {
    mockVerifyAndReceive.mockRejectedValue(new Error('Invalid signature'));
    const req = mockReq();
    const res = mockRes();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Webhook processing failed' });
  });
});
