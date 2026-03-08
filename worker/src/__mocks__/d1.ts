import { vi } from 'vitest';

interface MockD1Options {
  firstResult?: Record<string, unknown> | null;
  firstResults?: Array<Record<string, unknown> | null>;
}

export function createMockD1(options: MockD1Options = {}) {
  let callIndex = 0;
  const results = options.firstResults ?? [options.firstResult ?? null];

  const run = vi.fn().mockResolvedValue({ success: true });
  const first = vi.fn().mockImplementation(() => {
    const result = results[callIndex] ?? results[results.length - 1] ?? null;
    callIndex++;
    return Promise.resolve(result);
  });

  const bind = vi.fn().mockReturnValue({ first, run });
  const prepare = vi.fn().mockReturnValue({ bind, run, first });

  return { prepare, bind, first, run, resetCallIndex: () => { callIndex = 0; } };
}
