import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reviewDiff } from '../reviewer.js';

describe('reviewDiff (worker)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls Anthropic API and returns parsed comments', async () => {
    const comments = [
      { path: 'a.ts', line: 5, severity: 'warning', title: 'Bug', message: 'Fix this' },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify(comments) }],
      }),
    }));

    const result = await reviewDiff(
      'test-api-key',
      '+ const x = 1;',
      [{ filename: 'a.ts', additions: 1, deletions: 0, status: 'modified' }],
      'claude-haiku-4-5-20251001',
      30000,
    );

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('a.ts');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'test-api-key',
          'anthropic-version': '2023-06-01',
        }),
      }),
    );
  });

  it('sends correct model in request body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: '[]' }] }),
    }));

    await reviewDiff('key', 'diff', [], 'claude-sonnet-4-6', 30000);

    const callBody = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(callBody.model).toBe('claude-sonnet-4-6');
    expect(callBody.max_tokens).toBe(4096);
    expect(callBody.system).toContain('CodeSentri');
  });

  it('truncates diff when exceeding maxDiffSize', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: '[]' }] }),
    }));

    const largeDiff = 'x'.repeat(50000);
    await reviewDiff('key', largeDiff, [], 'haiku', 100);

    const callBody = JSON.parse((fetch as any).mock.calls[0][1].body);
    const prompt = callBody.messages[0].content;
    expect(prompt).toContain('(truncated)');
    expect(prompt.length).toBeLessThan(largeDiff.length);
  });

  it('includes file summary in prompt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: '[]' }] }),
    }));

    await reviewDiff('key', 'diff', [
      { filename: 'src/app.ts', additions: 10, deletions: 3, status: 'modified' },
      { filename: 'src/new.ts', additions: 50, deletions: 0, status: 'added' },
    ], 'haiku', 30000);

    const callBody = JSON.parse((fetch as any).mock.calls[0][1].body);
    const prompt = callBody.messages[0].content;
    expect(prompt).toContain('src/app.ts (+10/-3) [modified]');
    expect(prompt).toContain('src/new.ts (+50/-0) [added]');
  });

  it('returns empty array when no issues found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: '[]' }] }),
    }));

    const result = await reviewDiff('key', 'clean code', [], 'haiku', 30000);
    expect(result).toEqual([]);
  });

  it('throws on API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    }));

    await expect(
      reviewDiff('key', 'diff', [], 'haiku', 30000),
    ).rejects.toThrow('Anthropic API error: 429');
  });

  it('handles multiple text blocks in response', async () => {
    const comments = [
      { path: 'a.ts', line: 1, severity: 'critical', title: 'SQL Injection', message: 'Bad' },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          { type: 'text', text: JSON.stringify(comments) },
          { type: 'text', text: '' },
        ],
      }),
    }));

    const result = await reviewDiff('key', 'diff', [], 'haiku', 30000);
    expect(result).toHaveLength(1);
  });

  it('filters non-text blocks from response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          { type: 'tool_use', id: '1', name: 'test', input: {} },
          { type: 'text', text: '[]' },
        ],
      }),
    }));

    const result = await reviewDiff('key', 'diff', [], 'haiku', 30000);
    expect(result).toEqual([]);
  });
});
