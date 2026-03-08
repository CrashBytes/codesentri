import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../github.js', () => ({
  verifyWebhookSignature: vi.fn(),
  getInstallationToken: vi.fn().mockResolvedValue('mock-token'),
  githubAPI: vi.fn().mockResolvedValue([]),
}));

vi.mock('../reviewer.js', () => ({
  reviewDiff: vi.fn().mockResolvedValue([]),
}));

vi.mock('../usage.js', () => ({
  checkUsage: vi.fn().mockResolvedValue({
    limit: 5,
    model: 'haiku',
    maxDiffSize: 30000,
    maxFiles: 20,
    maxReviewsPerHour: 3,
  }),
}));

import worker from '../index.js';
import { verifyWebhookSignature, getInstallationToken, githubAPI } from '../github.js';
import { reviewDiff } from '../reviewer.js';
import { checkUsage } from '../usage.js';

function createMockEnv() {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
        }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    },
    GITHUB_APP_ID: '123',
    GITHUB_PRIVATE_KEY: 'key',
    GITHUB_WEBHOOK_SECRET: 'secret',
    ANTHROPIC_API_KEY: 'api-key',
  } as any;
}

function createWebhookRequest(body: object, event = 'pull_request') {
  return new Request('https://example.com/api/webhook', {
    method: 'POST',
    headers: {
      'x-hub-signature-256': 'sha256=valid',
      'x-github-event': event,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

const basePRPayload = {
  action: 'opened',
  pull_request: {
    number: 1,
    head: { sha: 'abc123' },
    user: { login: 'dev', type: 'User' },
  },
  repository: {
    name: 'repo',
    full_name: 'owner/repo',
    owner: { login: 'owner' },
  },
  installation: { id: 42 },
};

describe('Worker fetch routing', () => {
  it('returns health check', async () => {
    const req = new Request('https://example.com/health', { method: 'GET' });
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });

  it('returns 404 for unknown routes', async () => {
    const req = new Request('https://example.com/unknown', { method: 'GET' });
    const res = await worker.fetch(req, createMockEnv());
    expect(res.status).toBe(404);
  });

  it('returns 404 for GET on webhook endpoint', async () => {
    const req = new Request('https://example.com/api/webhook', { method: 'GET' });
    const res = await worker.fetch(req, createMockEnv());
    expect(res.status).toBe(404);
  });
});

describe('GitHub webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyWebhookSignature).mockResolvedValue(true);
    vi.mocked(getInstallationToken).mockResolvedValue('mock-token');
    vi.mocked(githubAPI).mockResolvedValue([]);
    vi.mocked(reviewDiff).mockResolvedValue([]);
    vi.mocked(checkUsage).mockResolvedValue({
      limit: 5, model: 'haiku', maxDiffSize: 30000, maxFiles: 20, maxReviewsPerHour: 3,
    });
  });

  it('rejects invalid signature', async () => {
    vi.mocked(verifyWebhookSignature).mockResolvedValue(false);
    const req = createWebhookRequest(basePRPayload);
    const res = await worker.fetch(req, createMockEnv());
    expect(res.status).toBe(401);
  });

  it('skips non-PR events', async () => {
    const req = createWebhookRequest({}, 'push');
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.skipped).toBe('not a PR event');
  });

  it('skips non-opened/synchronize actions', async () => {
    const req = createWebhookRequest({ ...basePRPayload, action: 'closed' });
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.skipped).toBe('action: closed');
  });

  it('skips bot PRs', async () => {
    const payload = {
      ...basePRPayload,
      pull_request: { ...basePRPayload.pull_request, user: { login: 'dependabot[bot]', type: 'Bot' } },
    };
    const req = createWebhookRequest(payload);
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.skipped).toBe('bot PR');
  });

  it('returns 400 when no installation', async () => {
    const { installation: _, ...payload } = basePRPayload;
    const req = createWebhookRequest(payload);
    const res = await worker.fetch(req, createMockEnv());
    expect(res.status).toBe(400);
  });

  it('skips when usage limit reached', async () => {
    vi.mocked(checkUsage).mockResolvedValue(null);
    const req = createWebhookRequest(basePRPayload);
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.skipped).toBe('usage limit reached');
  });

  it('skips when too many files', async () => {
    const manyFiles = Array.from({ length: 25 }, (_, i) => ({
      filename: `file${i}.ts`, additions: 1, deletions: 0, status: 'modified',
    }));
    vi.mocked(githubAPI).mockResolvedValueOnce(manyFiles);
    const req = createWebhookRequest(basePRPayload);
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.skipped).toBe('too many files');
  });

  it('posts APPROVE when no issues found', async () => {
    // First call: files, second call: diff, third call: post review
    vi.mocked(githubAPI)
      .mockResolvedValueOnce([{ filename: 'a.ts', additions: 1, deletions: 0, status: 'modified' }])
      .mockResolvedValueOnce('diff content')
      .mockResolvedValueOnce({});
    vi.mocked(reviewDiff).mockResolvedValue([]);

    const req = createWebhookRequest(basePRPayload);
    const env = createMockEnv();
    const res = await worker.fetch(req, env);
    const data = await res.json() as any;

    expect(data.ok).toBe(true);
    expect(data.comments).toBe(0);
    expect(githubAPI).toHaveBeenCalledWith('mock-token', 'POST',
      '/repos/owner/repo/pulls/1/reviews',
      expect.objectContaining({ event: 'APPROVE' })
    );
  });

  it('posts COMMENT review when issues found', async () => {
    const comments = [
      { path: 'a.ts', line: 5, severity: 'warning', title: 'Bug', message: 'Fix this' },
    ];
    vi.mocked(githubAPI)
      .mockResolvedValueOnce([{ filename: 'a.ts', additions: 1, deletions: 0, status: 'modified' }])
      .mockResolvedValueOnce('diff content')
      .mockResolvedValueOnce({});
    vi.mocked(reviewDiff).mockResolvedValue(comments as any);

    const req = createWebhookRequest(basePRPayload);
    const env = createMockEnv();
    const res = await worker.fetch(req, env);
    const data = await res.json() as any;

    expect(data.ok).toBe(true);
    expect(data.comments).toBe(1);
    expect(githubAPI).toHaveBeenCalledWith('mock-token', 'POST',
      '/repos/owner/repo/pulls/1/reviews',
      expect.objectContaining({
        event: 'COMMENT',
        commit_id: 'abc123',
      })
    );
  });

  it('tracks review in database', async () => {
    vi.mocked(githubAPI)
      .mockResolvedValueOnce([{ filename: 'a.ts', additions: 1, deletions: 0, status: 'modified' }])
      .mockResolvedValueOnce('diff')
      .mockResolvedValueOnce({});

    const req = createWebhookRequest(basePRPayload);
    const env = createMockEnv();
    await worker.fetch(req, env);

    expect(env.DB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO reviews')
    );
  });

  it('returns 500 on review failure', async () => {
    vi.mocked(githubAPI)
      .mockResolvedValueOnce([{ filename: 'a.ts', additions: 1, deletions: 0, status: 'modified' }])
      .mockResolvedValueOnce('diff');
    vi.mocked(reviewDiff).mockRejectedValue(new Error('API down'));

    const req = createWebhookRequest(basePRPayload);
    const res = await worker.fetch(req, createMockEnv());
    expect(res.status).toBe(500);
  });

  it('handles synchronize action', async () => {
    vi.mocked(githubAPI)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce({});
    vi.mocked(reviewDiff).mockResolvedValue([]);

    const payload = { ...basePRPayload, action: 'synchronize' };
    const req = createWebhookRequest(payload);
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.ok).toBe(true);
  });
});

describe('Marketplace webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles purchased event', async () => {
    const payload = {
      action: 'purchased',
      marketplace_purchase: {
        account: { id: 100, login: 'testuser', type: 'User' },
        plan: { name: 'Pro Plan' },
      },
    };
    const req = new Request('https://example.com/api/marketplace/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const env = createMockEnv();
    const res = await worker.fetch(req, env);
    const data = await res.json() as any;

    expect(data.ok).toBe(true);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO installations'));
  });

  it('handles cancelled event', async () => {
    const payload = {
      action: 'cancelled',
      marketplace_purchase: {
        account: { id: 100, login: 'testuser', type: 'User' },
        plan: { name: 'Pro Plan' },
      },
    };
    const req = new Request('https://example.com/api/marketplace/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const env = createMockEnv();
    const res = await worker.fetch(req, env);
    const data = await res.json() as any;

    expect(data.ok).toBe(true);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE installations'));
  });

  it('maps team plan correctly', async () => {
    const payload = {
      action: 'purchased',
      marketplace_purchase: {
        account: { id: 100, login: 'org', type: 'Organization' },
        plan: { name: 'Team Plan' },
      },
    };
    const req = new Request('https://example.com/api/marketplace/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const env = createMockEnv();
    await worker.fetch(req, env);

    // The bind call should include 'team' as the plan
    expect(env.DB.prepare().bind).toHaveBeenCalledWith(100, 'org', 'Organization', 'team');
  });
});
