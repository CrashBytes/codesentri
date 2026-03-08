import type { ReviewComment } from './types.js';

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

export async function reviewDiff(
  apiKey: string,
  diff: string,
  files: Array<{ filename: string; additions: number; deletions: number; status: string }>,
  model: string,
  maxDiffSize: number
): Promise<ReviewComment[]> {
  if (diff.length > maxDiffSize) {
    diff = diff.slice(0, maxDiffSize) + '\n... (truncated)';
  }

  const fileSummary = files
    .map(f => `  ${f.filename} (+${f.additions}/-${f.deletions}) [${f.status}]`)
    .join('\n');

  const prompt = `Review this pull request diff.

## Changed Files
${fileSummary}

## Diff
\`\`\`diff
${diff}
\`\`\`

Analyze the diff and return a JSON array of review comments. If no issues are found, return \`[]\`.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    throw new Error(`Anthropic API error: ${resp.status} ${await resp.text()}`);
  }

  const data = await resp.json() as {
    content: Array<{ type: string; text: string }>;
  };

  const text = data.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  return parseResponse(text);
}

function parseResponse(text: string): ReviewComment[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item: any) =>
      typeof item.path === 'string' &&
      typeof item.line === 'number' &&
      ['critical', 'warning', 'suggestion', 'nitpick'].includes(item.severity) &&
      typeof item.title === 'string' &&
      typeof item.message === 'string'
    );
  } catch {
    return [];
  }
}
