import { describe, it, expect } from 'vitest';
import { getPlanConfig } from '../plans.js';

describe('getPlanConfig', () => {
  it('returns free plan config', () => {
    const config = getPlanConfig('free');
    expect(config.limit).toBe(5);
    expect(config.model).toContain('haiku');
    expect(config.maxDiffSize).toBe(30_000);
    expect(config.maxFiles).toBe(20);
    expect(config.maxReviewsPerHour).toBe(3);
  });

  it('returns pro plan config', () => {
    const config = getPlanConfig('pro');
    expect(config.limit).toBe(100);
    expect(config.model).toContain('sonnet');
    expect(config.maxReviewsPerHour).toBe(20);
  });

  it('returns team plan config', () => {
    const config = getPlanConfig('team');
    expect(config.limit).toBe(500);
    expect(config.maxReviewsPerHour).toBe(50);
  });

  it('returns enterprise plan config', () => {
    const config = getPlanConfig('enterprise');
    expect(config.limit).toBe(Infinity);
    expect(config.maxFiles).toBe(200);
    expect(config.maxReviewsPerHour).toBe(Infinity);
  });

  it('falls back to free for unknown plan', () => {
    const config = getPlanConfig('nonexistent');
    expect(config.limit).toBe(5);
    expect(config.model).toContain('haiku');
  });

  it('falls back to free for empty string', () => {
    const config = getPlanConfig('');
    expect(config.limit).toBe(5);
  });
});
