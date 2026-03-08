import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockReviewDiff = vi.fn();
vi.mock('../../analysis/reviewer.js', () => ({
  reviewDiff: (...args: any[]) => mockReviewDiff(...args),
}));

const mockPostReviewComments = vi.fn();
vi.mock('../comments.js', () => ({
  postReviewComments: (...args: any[]) => mockPostReviewComments(...args),
}));

const mockCheckUsage = vi.fn();
vi.mock('../../billing/usage.js', () => ({
  checkUsage: (...args: any[]) => mockCheckUsage(...args),
}));

const mockOctokitRequest = vi.fn();
vi.mock('../app.js', () => ({
  getInstallationOctokit: vi.fn().mockResolvedValue({
    request: (...args: any[]) => mockOctokitRequest(...args),
  }),
}));

const mockDbQuery = vi.fn();
vi.mock('../../db/client.js', () => ({
  db: { query: (...args: any[]) => mockDbQuery(...args) },
}));

import { handlePullRequest } from '../handlers.js';

function makePayload(overrides: Record<string, any> = {}) {
  return {
    action: 'opened',
    pull_request: {
      number: 42,
      head: { sha: 'abc123' },
      user: { login: 'developer', type: 'User' },
    },
    repository: {
      name: 'my-repo',
      full_name: 'owner/my-repo',
      owner: { login: 'owner' },
    },
    installation: { id: 100 },
    ...overrides,
  };
}

describe('handlePullRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQuery.mockResolvedValue({ rows: [] });
  });

  it('skips when no installation in payload', async () => {
    await handlePullRequest(makePayload({ installation: undefined }));
    expect(mockCheckUsage).not.toHaveBeenCalled();
  });

  it('skips bot PRs', async () => {
    const payload = makePayload();
    payload.pull_request.user = { login: 'dependabot[bot]', type: 'Bot' };
    await handlePullRequest(payload);
    expect(mockCheckUsage).not.toHaveBeenCalled();
  });

  it('skips when usage limit reached', async () => {
    mockCheckUsage.mockResolvedValue(null);
    await handlePullRequest(makePayload());
    expect(mockOctokitRequest).not.toHaveBeenCalled();
  });

  it('skips when too many files for plan', async () => {
    mockCheckUsage.mockResolvedValue({ limit: 5, model: 'haiku', maxFiles: 2, maxDiffSize: 30000 });
    mockOctokitRequest.mockResolvedValueOnce({
      data: [{ filename: 'a.ts' }, { filename: 'b.ts' }, { filename: 'c.ts' }],
    });

    await handlePullRequest(makePayload());
    expect(mockReviewDiff).not.toHaveBeenCalled();
  });

  it('posts approval when no issues found', async () => {
    mockCheckUsage.mockResolvedValue({ limit: 100, model: 'sonnet', maxFiles: 100, maxDiffSize: 100000 });
    mockOctokitRequest
      .mockResolvedValueOnce({ data: [{ filename: 'a.ts' }] }) // files
      .mockResolvedValueOnce({ data: 'diff content' }) // diff
      .mockResolvedValueOnce({}); // approve review
    mockReviewDiff.mockResolvedValue([]);

    await handlePullRequest(makePayload());

    expect(mockOctokitRequest).toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
      expect.objectContaining({ event: 'APPROVE' }),
    );
  });

  it('posts review comments when issues found', async () => {
    const comments = [
      { path: 'a.ts', line: 1, severity: 'critical', title: 'SQL Injection', message: 'Bad' },
    ];
    mockCheckUsage.mockResolvedValue({ limit: 100, model: 'sonnet', maxFiles: 100, maxDiffSize: 100000 });
    mockOctokitRequest
      .mockResolvedValueOnce({ data: [{ filename: 'a.ts' }] })
      .mockResolvedValueOnce({ data: 'diff content' });
    mockReviewDiff.mockResolvedValue(comments);
    mockPostReviewComments.mockResolvedValue(undefined);

    await handlePullRequest(makePayload());

    expect(mockPostReviewComments).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        owner: 'owner',
        repo: 'my-repo',
        prNumber: 42,
        comments,
        commitSha: 'abc123',
      }),
    );
  });

  it('tracks review in database', async () => {
    mockCheckUsage.mockResolvedValue({ limit: 100, model: 'sonnet', maxFiles: 100, maxDiffSize: 100000 });
    mockOctokitRequest
      .mockResolvedValueOnce({ data: [{ filename: 'a.ts' }] })
      .mockResolvedValueOnce({ data: 'diff' })
      .mockResolvedValueOnce({});
    mockReviewDiff.mockResolvedValue([]);

    await handlePullRequest(makePayload());

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO reviews'),
      [100, 'owner/my-repo', 42, 0],
    );
  });

  it('passes plan model and maxDiffSize to reviewDiff', async () => {
    mockCheckUsage.mockResolvedValue({ limit: 100, model: 'claude-sonnet-4-6', maxFiles: 100, maxDiffSize: 100000 });
    mockOctokitRequest
      .mockResolvedValueOnce({ data: [{ filename: 'a.ts' }] })
      .mockResolvedValueOnce({ data: 'the diff' })
      .mockResolvedValueOnce({});
    mockReviewDiff.mockResolvedValue([]);

    await handlePullRequest(makePayload());

    expect(mockReviewDiff).toHaveBeenCalledWith(
      'the diff',
      expect.any(Array),
      'claude-sonnet-4-6',
      100000,
    );
  });
});
