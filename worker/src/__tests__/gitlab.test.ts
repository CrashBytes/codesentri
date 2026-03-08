import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyGitLabWebhookToken, gitlabAPI } from '../gitlab.js';

describe('verifyGitLabWebhookToken', () => {
  it('returns true for matching tokens', () => {
    expect(verifyGitLabWebhookToken('secret123', 'secret123')).toBe(true);
  });

  it('returns false for mismatched tokens', () => {
    expect(verifyGitLabWebhookToken('secret123', 'wrong')).toBe(false);
  });

  it('returns false for empty expected', () => {
    expect(verifyGitLabWebhookToken('', 'token')).toBe(false);
  });

  it('returns false for empty received', () => {
    expect(verifyGitLabWebhookToken('token', '')).toBe(false);
  });
});

describe('gitlabAPI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('makes request with PRIVATE-TOKEN header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    }));

    await gitlabAPI('https://gitlab.com', 'my-token', 'GET', '/projects/1');

    expect(fetch).toHaveBeenCalledWith(
      'https://gitlab.com/api/v4/projects/1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'PRIVATE-TOKEN': 'my-token',
        }),
      }),
    );
  });

  it('sends JSON body for POST', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    }));

    await gitlabAPI('https://gitlab.com', 'token', 'POST', '/projects/1/notes', { body: 'test' });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ body: 'test' }),
      }),
    );
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found'),
    }));

    await expect(gitlabAPI('https://gitlab.com', 'token', 'GET', '/projects/999'))
      .rejects.toThrow('GitLab API error: 404');
  });

  it('supports self-hosted GitLab URLs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));

    await gitlabAPI('https://git.mycompany.com', 'token', 'GET', '/projects/1');

    expect(fetch).toHaveBeenCalledWith(
      'https://git.mycompany.com/api/v4/projects/1',
      expect.any(Object),
    );
  });
});
