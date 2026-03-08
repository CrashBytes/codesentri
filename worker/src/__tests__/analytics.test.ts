import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackEvent, trackInstall, trackUninstall, trackReview, trackPlanChange } from '../analytics.js';
import type { Env } from '../types.js';

function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as any,
    GITHUB_APP_ID: '123',
    GITHUB_PRIVATE_KEY: 'key',
    GITHUB_WEBHOOK_SECRET: 'secret',
    ANTHROPIC_API_KEY: 'api-key',
    GA4_MEASUREMENT_ID: 'G-TEST123',
    GA4_API_SECRET: 'test-secret',
    ...overrides,
  };
}

describe('analytics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends event to GA4 Measurement Protocol', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const env = createMockEnv();

    await trackEvent(env, { name: 'test_event', params: { key: 'value' } });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('google-analytics.com/mp/collect'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('test_event'),
      }),
    );
  });

  it('includes measurement_id and api_secret in URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const env = createMockEnv();

    await trackEvent(env, { name: 'test', params: {} });

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain('measurement_id=G-TEST123');
    expect(url).toContain('api_secret=test-secret');
  });

  it('skips when GA4_MEASUREMENT_ID is empty', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const env = createMockEnv({ GA4_MEASUREMENT_ID: '' });

    await trackEvent(env, { name: 'test', params: {} });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('skips when GA4_API_SECRET is empty', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const env = createMockEnv({ GA4_API_SECRET: '' });

    await trackEvent(env, { name: 'test', params: {} });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not throw on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const env = createMockEnv();

    await expect(trackEvent(env, { name: 'test', params: {} })).resolves.toBeUndefined();
  });

  it('trackInstall sends app_install event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const env = createMockEnv();

    await trackInstall(env, 'testuser', 'User', 42);

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.events[0].name).toBe('app_install');
    expect(body.events[0].params.account_login).toBe('testuser');
    expect(body.events[0].params.installation_id).toBe(42);
    expect(body.client_id).toBe('worker-42');
  });

  it('trackUninstall sends app_uninstall event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const env = createMockEnv();

    await trackUninstall(env, 'testuser', 42);

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.events[0].name).toBe('app_uninstall');
  });

  it('trackReview sends review_completed event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const env = createMockEnv();

    await trackReview(env, 42, 'owner/repo', 3);

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.events[0].name).toBe('review_completed');
    expect(body.events[0].params.repo).toBe('owner/repo');
    expect(body.events[0].params.comments_count).toBe(3);
  });

  it('trackPlanChange sends plan_change event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const env = createMockEnv();

    await trackPlanChange(env, 'testuser', 'pro', 'purchased');

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.events[0].name).toBe('plan_change');
    expect(body.events[0].params.plan).toBe('pro');
    expect(body.events[0].params.action).toBe('purchased');
  });
});
