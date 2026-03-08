import { describe, it, expect } from 'vitest';
import { parseResponse } from '../reviewer.js';

describe('parseResponse', () => {
  it('parses valid JSON array of comments', () => {
    const input = JSON.stringify([
      {
        path: 'src/app.ts',
        line: 10,
        severity: 'warning',
        title: 'Missing null check',
        message: 'This could throw if value is null.',
      },
    ]);
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/app.ts');
    expect(result[0].severity).toBe('warning');
  });

  it('extracts JSON from surrounding text', () => {
    const input = `Here are the issues I found:\n${JSON.stringify([
      { path: 'a.ts', line: 1, severity: 'critical', title: 'Bug', message: 'Desc' },
    ])}\nThat's all.`;
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('critical');
  });

  it('returns empty array for empty JSON array', () => {
    expect(parseResponse('[]')).toEqual([]);
  });

  it('returns empty array for no JSON found', () => {
    expect(parseResponse('No issues found in this code.')).toEqual([]);
  });

  it('returns empty array for malformed JSON', () => {
    expect(parseResponse('[{invalid json')).toEqual([]);
  });

  it('filters out comments with missing required fields', () => {
    const input = JSON.stringify([
      { path: 'a.ts', line: 1, severity: 'warning', title: 'Good', message: 'Valid' },
      { path: 'b.ts', line: 'not-a-number', severity: 'warning', title: 'Bad', message: 'Invalid line' },
      { severity: 'warning', title: 'No path', message: 'Missing path' },
      { path: 'c.ts', line: 3, severity: 'unknown', title: 'Bad severity', message: 'Invalid' },
    ]);
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('a.ts');
  });

  it('accepts nitpick severity', () => {
    const input = JSON.stringify([
      { path: 'a.ts', line: 1, severity: 'nitpick', title: 'Style', message: 'Minor' },
    ]);
    expect(parseResponse(input)).toHaveLength(1);
  });

  it('accepts suggestion severity', () => {
    const input = JSON.stringify([
      { path: 'a.ts', line: 1, severity: 'suggestion', title: 'Idea', message: 'Consider this' },
    ]);
    expect(parseResponse(input)).toHaveLength(1);
  });

  it('preserves optional suggestion field', () => {
    const input = JSON.stringify([
      { path: 'a.ts', line: 1, severity: 'warning', title: 'Fix', message: 'Issue', suggestion: 'const x = 1;' },
    ]);
    const result = parseResponse(input);
    expect(result[0].suggestion).toBe('const x = 1;');
  });
});
