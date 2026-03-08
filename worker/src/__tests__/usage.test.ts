import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkUsage } from '../usage.js';

vi.mock('../plans.js', () => ({
  getPlanConfig: vi.fn((plan: string) => {
    const plans: Record<string, any> = {
      free: { limit: 5, model: 'haiku', maxDiffSize: 30000, maxFiles: 20, maxReviewsPerHour: 3 },
      pro: { limit: 100, model: 'sonnet', maxDiffSize: 100000, maxFiles: 100, maxReviewsPerHour: 20 },
    };
    return plans[plan] ?? plans.free;
  }),
}));

function createMockDB(options: {
  installation?: Record<string, unknown> | null;
  hourlyCount?: number;
}) {
  const { installation = null, hourlyCount = 0 } = options;
  let callCount = 0;

  const run = vi.fn().mockResolvedValue({ success: true });
  const first = vi.fn().mockImplementation(() => {
    callCount++;
    // Call 1: reset expired (returns nothing, uses .run())
    // Call 2: SELECT installation
    if (callCount === 1) return Promise.resolve(installation);
    // Call 3: SELECT hourly count
    if (callCount === 2) return Promise.resolve({ count: hourlyCount });
    return Promise.resolve(null);
  });

  const bind = vi.fn().mockReturnValue({ first, run });
  const prepare = vi.fn().mockReturnValue({ bind, run, first });

  return { prepare, bind, first, run } as any;
}

describe('checkUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns free plan config for unknown installation', async () => {
    const db = createMockDB({ installation: null });
    const result = await checkUsage(db, 999);
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(5);
  });

  it('returns plan config when under limit', async () => {
    const db = createMockDB({
      installation: { plan: 'pro', reviews_this_month: 10 },
      hourlyCount: 1,
    });
    const result = await checkUsage(db, 123);
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(100);
  });

  it('returns null when monthly limit reached', async () => {
    const db = createMockDB({
      installation: { plan: 'free', reviews_this_month: 5 },
    });
    const result = await checkUsage(db, 123);
    expect(result).toBeNull();
  });

  it('returns null when hourly rate limit reached', async () => {
    const db = createMockDB({
      installation: { plan: 'free', reviews_this_month: 2 },
      hourlyCount: 3,
    });
    const result = await checkUsage(db, 123);
    expect(result).toBeNull();
  });

  it('increments usage counter on success', async () => {
    const db = createMockDB({
      installation: { plan: 'pro', reviews_this_month: 50 },
      hourlyCount: 5,
    });
    await checkUsage(db, 123);
    // Should call prepare at least 4 times: reset, select install, hourly check, increment
    expect(db.prepare.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('runs monthly reset query', async () => {
    const db = createMockDB({ installation: null });
    await checkUsage(db, 123);
    // First prepare call should be the reset query
    expect(db.prepare.mock.calls[0][0]).toContain('UPDATE installations');
    expect(db.prepare.mock.calls[0][0]).toContain('reviews_this_month = 0');
  });
});
