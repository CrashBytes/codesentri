import { describe, it, expect } from 'vitest';
import { buildReviewPrompt } from '../prompts.js';

describe('buildReviewPrompt', () => {
  it('includes file summary', () => {
    const files = [
      { filename: 'src/app.ts', additions: 10, deletions: 3, status: 'modified' },
      { filename: 'src/new.ts', additions: 50, deletions: 0, status: 'added' },
    ];
    const result = buildReviewPrompt('diff content', files);
    expect(result).toContain('src/app.ts (+10/-3) [modified]');
    expect(result).toContain('src/new.ts (+50/-0) [added]');
  });

  it('includes diff in code block', () => {
    const result = buildReviewPrompt('+ const x = 1;', []);
    expect(result).toContain('```diff');
    expect(result).toContain('+ const x = 1;');
    expect(result).toContain('```');
  });

  it('includes instruction to return JSON array', () => {
    const result = buildReviewPrompt('diff', []);
    expect(result).toContain('JSON array');
    expect(result).toContain('[]');
  });

  it('handles empty files list', () => {
    const result = buildReviewPrompt('diff', []);
    expect(result).toContain('## Changed Files');
    expect(result).toContain('## Diff');
  });
});
