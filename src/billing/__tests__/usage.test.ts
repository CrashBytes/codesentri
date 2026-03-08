import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockGetInstallation = vi.fn();
const mockIncrementUsage = vi.fn();
const mockResetMonthlyUsage = vi.fn();
const mockDbQuery = vi.fn();

vi.mock('../../db/queries.js', () => ({
  getInstallation: (...args: any[]) => mockGetInstallation(...args),
  incrementUsage: (...args: any[]) => mockIncrementUsage(...args),
  resetMonthlyUsage: (...args: any[]) => mockResetMonthlyUsage(...args),
}));

vi.mock('../../db/client.js', () => ({
  db: { query: (...args: any[]) => mockDbQuery(...args) },
}));

import { checkUsage, getPlanConfig } from '../usage.js';

describe('getPlanConfig (src)', () => {
  it('returns free plan', () => {
    const config = getPlanConfig('free');
    expect(config.limit).toBe(5);
    expect(config.model).toContain('haiku');
  });

  it('returns pro plan', () => {
    const config = getPlanConfig('pro');
    expect(config.limit).toBe(100);
  });

  it('returns team plan', () => {
    const config = getPlanConfig('team');
    expect(config.limit).toBe(500);
  });

  it('returns enterprise plan', () => {
    const config = getPlanConfig('enterprise');
    expect(config.limit).toBe(Infinity);
  });

  it('falls back to free for unknown', () => {
    expect(getPlanConfig('unknown').limit).toBe(5);
  });
});

describe('checkUsage (src)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResetMonthlyUsage.mockResolvedValue(undefined);
    mockIncrementUsage.mockResolvedValue(undefined);
  });

  it('returns free plan for unknown installation', async () => {
    mockGetInstallation.mockResolvedValue(null);
    const result = await checkUsage(999);
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(5);
  });

  it('returns plan config when under limit', async () => {
    mockGetInstallation.mockResolvedValue({ plan: 'pro', reviews_this_month: 10 });
    mockDbQuery.mockResolvedValue({ rows: [{ count: '1' }] });
    const result = await checkUsage(123);
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(100);
  });

  it('returns null when monthly limit reached', async () => {
    mockGetInstallation.mockResolvedValue({ plan: 'free', reviews_this_month: 5 });
    const result = await checkUsage(123);
    expect(result).toBeNull();
  });

  it('returns null when hourly rate limit reached', async () => {
    mockGetInstallation.mockResolvedValue({ plan: 'free', reviews_this_month: 2 });
    mockDbQuery.mockResolvedValue({ rows: [{ count: '3' }] });
    const result = await checkUsage(123);
    expect(result).toBeNull();
  });

  it('skips hourly check for enterprise (Infinity)', async () => {
    mockGetInstallation.mockResolvedValue({ plan: 'enterprise', reviews_this_month: 100 });
    const result = await checkUsage(123);
    expect(result).not.toBeNull();
    expect(mockDbQuery).not.toHaveBeenCalled();
  });

  it('increments usage on success', async () => {
    mockGetInstallation.mockResolvedValue({ plan: 'pro', reviews_this_month: 10 });
    mockDbQuery.mockResolvedValue({ rows: [{ count: '0' }] });
    await checkUsage(123);
    expect(mockIncrementUsage).toHaveBeenCalledWith(123);
  });

  it('calls resetMonthlyUsage on every check', async () => {
    mockGetInstallation.mockResolvedValue(null);
    await checkUsage(123);
    expect(mockResetMonthlyUsage).toHaveBeenCalled();
  });
});
