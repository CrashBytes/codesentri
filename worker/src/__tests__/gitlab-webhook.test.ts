import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../github.js', () => ({
  verifyWebhookSignature: vi.fn().mockResolvedValue(true),
  getInstallationToken: vi.fn().mockResolvedValue('mock-token'),
  githubAPI: vi.fn().mockResolvedValue([]),
}));

vi.mock('../reviewer.js', () => ({
  reviewDiff: vi.fn().mockResolvedValue([]),
}));

vi.mock('../usage.js', () => ({
  checkUsage: vi.fn().mockResolvedValue({
    limit: 5, model: 'haiku', maxDiffSize: 30000, maxFiles: 20, maxReviewsPerHour: 3,
  }),
}));

vi.mock('../gitlab.js', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    lookupConnectionBySecret: vi.fn().mockResolvedValue({
      installation_id: 100,
      gitlab_url: 'https://gitlab.com',
      project_id: 42,
      project_path: 'user/repo',
      access_token: 'glpat-test',
    }),
    getMergeRequestDiff: vi.fn().mockResolvedValue({
      diff: '+ const x = 1;',
      files: [{ filename: 'app.ts', additions: 1, deletions: 0, status: 'modified' }],
    }),
    getDiffVersions: vi.fn().mockResolvedValue({
      base_commit_sha: 'aaa',
      start_commit_sha: 'bbb',
      head_commit_sha: 'ccc',
    }),
    postMRDiscussion: vi.fn().mockResolvedValue(undefined),
    postMRNote: vi.fn().mockResolvedValue(undefined),
    createGitLabConnection: vi.fn().mockResolvedValue({
      installationId: 100,
      webhookSecret: 'secret-uuid',
      webhookUrl: 'https://codesentri.michael-eakins.workers.dev/api/gitlab/webhook',
    }),
    gitlabAPI: vi.fn().mockResolvedValue({ id: 42, path_with_namespace: 'user/repo' }),
  };
});

vi.mock('../analytics.js', () => ({
  trackInstall: vi.fn(),
  trackUninstall: vi.fn(),
  trackReview: vi.fn(),
  trackPlanChange: vi.fn(),
}));

import worker from '../index.js';
import { lookupConnectionBySecret, postMRNote, postMRDiscussion } from '../gitlab.js';
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
    GA4_MEASUREMENT_ID: '',
    GA4_API_SECRET: '',
  } as any;
}

function createGitLabWebhookRequest(payload: object, token = 'valid-secret') {
  return new Request('https://example.com/api/gitlab/webhook', {
    method: 'POST',
    headers: {
      'x-gitlab-token': token,
      'x-gitlab-event': 'Merge Request Hook',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

const baseMRPayload = {
  object_attributes: {
    iid: 1,
    action: 'open',
    target_branch: 'main',
    source_branch: 'feature',
  },
  user: { username: 'developer' },
  project: { id: 42, path_with_namespace: 'user/repo' },
};

describe('GitLab webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lookupConnectionBySecret).mockResolvedValue({
      installation_id: 100,
      gitlab_url: 'https://gitlab.com',
      project_id: 42,
      project_path: 'user/repo',
      access_token: 'glpat-test',
    });
    vi.mocked(reviewDiff).mockResolvedValue([]);
    vi.mocked(checkUsage).mockResolvedValue({
      limit: 5, model: 'haiku', maxDiffSize: 30000, maxFiles: 20, maxReviewsPerHour: 3,
    });
  });

  it('rejects missing webhook token', async () => {
    const req = new Request('https://example.com/api/gitlab/webhook', {
      method: 'POST',
      headers: { 'x-gitlab-event': 'Merge Request Hook', 'content-type': 'application/json' },
      body: JSON.stringify(baseMRPayload),
    });
    const res = await worker.fetch(req, createMockEnv());
    expect(res.status).toBe(401);
  });

  it('skips non-MR events', async () => {
    const req = new Request('https://example.com/api/gitlab/webhook', {
      method: 'POST',
      headers: { 'x-gitlab-token': 'token', 'x-gitlab-event': 'Push Hook', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.skipped).toBe('event: Push Hook');
  });

  it('skips non-open/update actions', async () => {
    const payload = { ...baseMRPayload, object_attributes: { ...baseMRPayload.object_attributes, action: 'close' } };
    const req = createGitLabWebhookRequest(payload);
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.skipped).toBe('action: close');
  });

  it('rejects unknown webhook token', async () => {
    vi.mocked(lookupConnectionBySecret).mockResolvedValue(null);
    const req = createGitLabWebhookRequest(baseMRPayload);
    const res = await worker.fetch(req, createMockEnv());
    expect(res.status).toBe(401);
  });

  it('skips bot MRs', async () => {
    const payload = { ...baseMRPayload, user: { username: 'renovate-bot' } };
    const req = createGitLabWebhookRequest(payload);
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.skipped).toBe('bot MR');
  });

  it('skips when usage limit reached', async () => {
    vi.mocked(checkUsage).mockResolvedValue(null);
    const req = createGitLabWebhookRequest(baseMRPayload);
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.skipped).toBe('usage limit reached');
  });

  it('posts note when no issues found', async () => {
    vi.mocked(reviewDiff).mockResolvedValue([]);
    const req = createGitLabWebhookRequest(baseMRPayload);
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.ok).toBe(true);
    expect(data.comments).toBe(0);
    expect(postMRNote).toHaveBeenCalledWith(
      'https://gitlab.com', 'glpat-test', 42, 1,
      expect.stringContaining('no issues'),
    );
  });

  it('posts inline discussions when issues found', async () => {
    vi.mocked(reviewDiff).mockResolvedValue([
      { path: 'app.ts', line: 5, severity: 'warning', title: 'Bug', message: 'Fix this' },
    ] as any);
    const req = createGitLabWebhookRequest(baseMRPayload);
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.ok).toBe(true);
    expect(data.comments).toBe(1);
    expect(postMRDiscussion).toHaveBeenCalled();
    expect(postMRNote).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), expect.any(Number), expect.any(Number),
      expect.stringContaining('1 issue'),
    );
  });

  it('handles update action', async () => {
    const payload = { ...baseMRPayload, object_attributes: { ...baseMRPayload.object_attributes, action: 'update' } };
    const req = createGitLabWebhookRequest(payload);
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.ok).toBe(true);
  });
});

describe('GitLab setup endpoint', () => {
  it('validates required fields', async () => {
    const req = new Request('https://example.com/api/gitlab/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: null, access_token: '' }),
    });
    const res = await worker.fetch(req, createMockEnv());
    expect(res.status).toBe(400);
  });

  it('creates connection with valid input', async () => {
    const req = new Request('https://example.com/api/gitlab/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        gitlab_url: 'https://gitlab.com',
        project_id: 42,
        access_token: 'glpat-test',
      }),
    });
    const res = await worker.fetch(req, createMockEnv());
    const data = await res.json() as any;
    expect(data.ok).toBe(true);
    expect(data.project).toBe('user/repo');
  });
});
