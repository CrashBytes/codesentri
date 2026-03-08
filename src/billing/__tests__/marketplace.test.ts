import { describe, it, expect } from 'vitest';
import { planFromMarketplace } from '../marketplace.js';

describe('planFromMarketplace', () => {
  it('maps team plan', () => {
    expect(planFromMarketplace('Team Plan')).toBe('team');
    expect(planFromMarketplace('CodeSentri Team')).toBe('team');
  });

  it('maps pro plan', () => {
    expect(planFromMarketplace('Pro Plan')).toBe('pro');
    expect(planFromMarketplace('CodeSentri Pro')).toBe('pro');
  });

  it('maps free plan', () => {
    expect(planFromMarketplace('Free')).toBe('free');
    expect(planFromMarketplace('CodeSentri Free')).toBe('free');
  });

  it('defaults to free for unknown plan', () => {
    expect(planFromMarketplace('Enterprise')).toBe('free');
    expect(planFromMarketplace('')).toBe('free');
  });

  it('is case insensitive', () => {
    expect(planFromMarketplace('TEAM PLAN')).toBe('team');
    expect(planFromMarketplace('pro plan')).toBe('pro');
    expect(planFromMarketplace('PRO')).toBe('pro');
  });

  it('prioritizes team over pro if both present', () => {
    expect(planFromMarketplace('Pro Team Plan')).toBe('team');
  });
});
