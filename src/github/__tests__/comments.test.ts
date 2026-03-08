import { describe, it, expect, vi } from 'vitest';

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { postReviewComments } from '../comments.js';
import type { ReviewComment } from '../../analysis/types.js';

function createMockOctokit(mockResponse = {}) {
  return {
    request: vi.fn().mockResolvedValue(mockResponse),
  } as any;
}

describe('postReviewComments', () => {
  it('posts review with formatted comments', async () => {
    const octokit = createMockOctokit();
    const comments: ReviewComment[] = [
      { path: 'src/app.ts', line: 10, severity: 'warning', title: 'Null check', message: 'Could be null' },
    ];

    await postReviewComments(octokit, {
      owner: 'owner',
      repo: 'repo',
      prNumber: 1,
      comments,
      commitSha: 'abc123',
    });

    expect(octokit.request).toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
      expect.objectContaining({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
        commit_id: 'abc123',
        event: 'COMMENT',
      }),
    );
  });

  it('includes correct comment count in body', async () => {
    const octokit = createMockOctokit();
    const comments: ReviewComment[] = [
      { path: 'a.ts', line: 1, severity: 'warning', title: 'A', message: 'a' },
      { path: 'b.ts', line: 2, severity: 'critical', title: 'B', message: 'b' },
    ];

    await postReviewComments(octokit, {
      owner: 'o', repo: 'r', prNumber: 1, comments, commitSha: 'sha',
    });

    const call = octokit.request.mock.calls[0][1];
    expect(call.body).toContain('2 issues');
  });

  it('uses singular "issue" for single comment', async () => {
    const octokit = createMockOctokit();
    const comments: ReviewComment[] = [
      { path: 'a.ts', line: 1, severity: 'warning', title: 'A', message: 'a' },
    ];

    await postReviewComments(octokit, {
      owner: 'o', repo: 'r', prNumber: 1, comments, commitSha: 'sha',
    });

    const call = octokit.request.mock.calls[0][1];
    expect(call.body).toContain('1 issue');
    expect(call.body).not.toContain('1 issues');
  });

  it('formats severity labels in comment body', async () => {
    const octokit = createMockOctokit();
    const comments: ReviewComment[] = [
      { path: 'a.ts', line: 1, severity: 'critical', title: 'SQL Injection', message: 'Danger' },
    ];

    await postReviewComments(octokit, {
      owner: 'o', repo: 'r', prNumber: 1, comments, commitSha: 'sha',
    });

    const ghComment = octokit.request.mock.calls[0][1].comments[0];
    expect(ghComment.body).toContain('[CRITICAL]');
    expect(ghComment.body).toContain('**SQL Injection**');
    expect(ghComment.side).toBe('RIGHT');
  });

  it('includes suggestion block when present', async () => {
    const octokit = createMockOctokit();
    const comments: ReviewComment[] = [
      { path: 'a.ts', line: 1, severity: 'suggestion', title: 'Fix', message: 'Try this', suggestion: 'const x = 1;' },
    ];

    await postReviewComments(octokit, {
      owner: 'o', repo: 'r', prNumber: 1, comments, commitSha: 'sha',
    });

    const ghComment = octokit.request.mock.calls[0][1].comments[0];
    expect(ghComment.body).toContain('```suggestion');
    expect(ghComment.body).toContain('const x = 1;');
  });

  it('throws on API failure', async () => {
    const octokit = { request: vi.fn().mockRejectedValue(new Error('API error')) } as any;
    const comments: ReviewComment[] = [
      { path: 'a.ts', line: 1, severity: 'warning', title: 'A', message: 'a' },
    ];

    await expect(
      postReviewComments(octokit, { owner: 'o', repo: 'r', prNumber: 1, comments, commitSha: 'sha' }),
    ).rejects.toThrow('API error');
  });
});
