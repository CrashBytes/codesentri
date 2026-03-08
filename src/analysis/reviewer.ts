import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { buildReviewPrompt } from './prompts.js';
import { parseReviewResponse } from './parser.js';
import type { ReviewComment, FileChange } from './types.js';
import { logger } from '../logger.js';

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

const SYSTEM_PROMPT = `You are CodeSentri, an expert AI code reviewer. Your job is to review pull request diffs and identify:

1. **Bugs & Logic Errors** - Off-by-one errors, null pointer risks, race conditions, incorrect logic
2. **Security Vulnerabilities** - Injection flaws, auth issues, sensitive data exposure, OWASP Top 10
3. **Performance Issues** - N+1 queries, unnecessary allocations, algorithmic complexity
4. **Best Practice Violations** - Code smells, missing error handling, anti-patterns

Rules:
- Only comment on CHANGED lines (lines starting with + in the diff)
- Be specific and actionable. Explain WHY something is an issue and HOW to fix it
- Include code suggestions when possible
- Do NOT nitpick style/formatting unless it causes readability issues
- Do NOT repeat yourself across comments
- If the code looks good, return an empty array

Respond with a JSON array of review comments. Each comment must have:
- "path": the file path
- "line": the line number in the NEW file (from the diff hunk header)
- "severity": "critical" | "warning" | "suggestion"
- "title": short summary (under 80 chars)
- "message": detailed explanation
- "suggestion": optional replacement code for the line(s)

Respond ONLY with the JSON array, no other text.`;

export async function reviewDiff(diff: string, files: FileChange[], model = 'claude-haiku-4-5-20251001', maxDiffSize = 30_000): Promise<ReviewComment[]> {
  if (diff.length > maxDiffSize) {
    logger.warn({ diffLength: diff.length, maxDiffSize }, 'Diff too large, truncating');
    diff = diff.slice(0, maxDiffSize) + '\n... (truncated)';
  }

  const prompt = buildReviewPrompt(diff, files);

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
    system: SYSTEM_PROMPT,
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  return parseReviewResponse(text);
}
