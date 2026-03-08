import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock('../../config.js', () => ({
  config: { anthropic: { apiKey: 'test-key' } },
}));

import { reviewDiff } from '../reviewer.js';

describe('reviewDiff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends diff to Claude and returns parsed comments', async () => {
    const comments = [
      { path: 'src/app.ts', line: 10, severity: 'warning', title: 'Bug', message: 'Details' },
    ];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(comments) }],
    });

    const result = await reviewDiff('+ const x = 1;', [{ filename: 'src/app.ts', additions: 1, deletions: 0, status: 'modified' }]);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/app.ts');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
      }),
    );
  });

  it('uses custom model when provided', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });

    await reviewDiff('diff', [], 'claude-sonnet-4-6');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-6' }),
    );
  });

  it('returns empty array when Claude finds no issues', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });

    const result = await reviewDiff('+ good code', []);
    expect(result).toEqual([]);
  });

  it('truncates diff when exceeding maxDiffSize', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });

    const largeDiff = 'x'.repeat(50_000);
    await reviewDiff(largeDiff, [], undefined, 100);

    const call = mockCreate.mock.calls[0][0];
    const userMessage = call.messages[0].content;
    expect(userMessage).toContain('(truncated)');
  });

  it('includes system prompt with CodeSentri instructions', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });

    await reviewDiff('diff', []);

    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('CodeSentri');
    expect(call.system).toContain('JSON array');
  });

  it('handles multiple text blocks in response', async () => {
    const comments = [
      { path: 'a.ts', line: 1, severity: 'critical', title: 'Issue', message: 'Bad' },
    ];
    mockCreate.mockResolvedValue({
      content: [
        { type: 'text', text: JSON.stringify(comments) },
        { type: 'text', text: '' },
      ],
    });

    const result = await reviewDiff('diff', []);
    expect(result).toHaveLength(1);
  });

  it('filters out non-text blocks', async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: 'tool_use', id: '1', name: 'test', input: {} },
        { type: 'text', text: '[]' },
      ],
    });

    const result = await reviewDiff('diff', []);
    expect(result).toEqual([]);
  });

  it('propagates API errors', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limit'));

    await expect(reviewDiff('diff', [])).rejects.toThrow('API rate limit');
  });
});
