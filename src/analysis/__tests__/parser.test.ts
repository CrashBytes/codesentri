import { describe, it, expect, vi } from 'vitest';

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { parseReviewResponse } from '../parser.js';

describe('parseReviewResponse', () => {
  it('parses valid JSON array', () => {
    const input = JSON.stringify([
      { path: 'src/app.ts', line: 10, severity: 'warning', title: 'Bug', message: 'Details' },
    ]);
    const result = parseReviewResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/app.ts');
  });

  it('extracts JSON from surrounding text', () => {
    const json = JSON.stringify([
      { path: 'a.ts', line: 1, severity: 'critical', title: 'Issue', message: 'Desc' },
    ]);
    const result = parseReviewResponse(`Here are issues:\n${json}\nDone.`);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for empty JSON array', () => {
    expect(parseReviewResponse('[]')).toEqual([]);
  });

  it('returns empty array for no JSON', () => {
    expect(parseReviewResponse('Everything looks good!')).toEqual([]);
  });

  it('returns empty array for malformed JSON', () => {
    expect(parseReviewResponse('[{broken')).toEqual([]);
  });

  it('filters out invalid entries', () => {
    const input = JSON.stringify([
      { path: 'a.ts', line: 1, severity: 'warning', title: 'Good', message: 'Valid' },
      { path: 'b.ts', line: 'bad', severity: 'warning', title: 'Bad', message: 'Invalid' },
      { severity: 'critical', title: 'No path', message: 'Missing' },
    ]);
    const result = parseReviewResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('a.ts');
  });

  it('maps suggestion field correctly', () => {
    const input = JSON.stringify([
      { path: 'a.ts', line: 1, severity: 'suggestion', title: 'Fix', message: 'Do this', suggestion: 'code here' },
    ]);
    const result = parseReviewResponse(input);
    expect(result[0].suggestion).toBe('code here');
  });

  it('sets suggestion to undefined when absent', () => {
    const input = JSON.stringify([
      { path: 'a.ts', line: 1, severity: 'warning', title: 'Fix', message: 'Issue' },
    ]);
    const result = parseReviewResponse(input);
    expect(result[0].suggestion).toBeUndefined();
  });

  it('returns empty array for non-array JSON', () => {
    expect(parseReviewResponse('{"not": "array"}')).toEqual([]);
  });
});
