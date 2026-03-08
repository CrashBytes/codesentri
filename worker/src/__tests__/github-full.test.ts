import { describe, it, expect, vi, beforeEach } from 'vitest';

// We can't easily test createJWT with fake keys, so we test getInstallationToken
// by mocking fetch at the network layer and testing the full flow minus crypto
describe('getInstallationToken (integration)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('makes POST request to correct GitHub endpoint', async () => {
    // Generate a real RSA key pair for testing
    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    );

    const exported = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const pemBody = btoa(String.fromCharCode(...new Uint8Array(exported)));
    const pem = `-----BEGIN PRIVATE KEY-----\n${pemBody}\n-----END PRIVATE KEY-----`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'ghs_abc123' }),
    }));

    const { getInstallationToken } = await import('../github.js');

    const env = {
      GITHUB_APP_ID: '99',
      GITHUB_PRIVATE_KEY: pem,
      GITHUB_WEBHOOK_SECRET: 'secret',
      ANTHROPIC_API_KEY: 'key',
    } as any;

    const token = await getInstallationToken(env, 42);
    expect(token).toBe('ghs_abc123');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/app/installations/42/access_tokens',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/vnd.github+json',
          'User-Agent': 'CodeSentri',
        }),
      }),
    );

    // Verify the Authorization header contains a JWT (Bearer <token>)
    const authHeader = (fetch as any).mock.calls[0][1].headers.Authorization;
    expect(authHeader).toMatch(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it('throws on non-ok response from GitHub', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    );

    const exported = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const pemBody = btoa(String.fromCharCode(...new Uint8Array(exported)));
    const pem = `-----BEGIN PRIVATE KEY-----\n${pemBody}\n-----END PRIVATE KEY-----`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Bad credentials'),
    }));

    const { getInstallationToken } = await import('../github.js');

    const env = {
      GITHUB_APP_ID: '99',
      GITHUB_PRIVATE_KEY: pem,
    } as any;

    await expect(getInstallationToken(env, 42)).rejects.toThrow('Failed to get installation token: 401');
  });
});
