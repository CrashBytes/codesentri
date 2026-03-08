import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyWebhookSignature, githubAPI } from '../github.js';

describe('verifyWebhookSignature', () => {
  it('returns true for valid signature', async () => {
    const secret = 'test-secret';
    const payload = '{"action":"opened"}';

    // Generate expected signature using the same algorithm
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expected =
      'sha256=' +
      Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const result = await verifyWebhookSignature(secret, payload, expected);
    expect(result).toBe(true);
  });

  it('returns false for invalid signature', async () => {
    const result = await verifyWebhookSignature('secret', 'payload', 'sha256=invalid');
    expect(result).toBe(false);
  });

  it('returns false for empty signature', async () => {
    const result = await verifyWebhookSignature('secret', 'payload', '');
    expect(result).toBe(false);
  });

  it('returns false for wrong secret', async () => {
    const secret = 'correct-secret';
    const payload = 'test';

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const validSig =
      'sha256=' +
      Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const result = await verifyWebhookSignature('wrong-secret', payload, validSig);
    expect(result).toBe(false);
  });
});

describe('githubAPI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('makes GET request with correct headers', async () => {
    const mockResponse = { data: 'test' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      }),
    );

    const result = await githubAPI('test-token', 'GET', '/repos/owner/repo');
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'token test-token',
          'User-Agent': 'CodeSentri',
        }),
      }),
    );
  });

  it('sends JSON body for POST requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ id: 1 }),
      }),
    );

    await githubAPI('token', 'POST', '/repos/owner/repo/reviews', { event: 'APPROVE' });
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ event: 'APPROVE' }),
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('returns text for non-JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/vnd.github.diff' }),
        text: () => Promise.resolve('diff --git a/file'),
      }),
    );

    const result = await githubAPI('token', 'GET', '/repos/owner/repo/pulls/1', undefined, 'application/vnd.github.diff');
    expect(result).toBe('diff --git a/file');
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      }),
    );

    await expect(githubAPI('token', 'GET', '/repos/owner/repo')).rejects.toThrow('GitHub API error: 404');
  });
});
