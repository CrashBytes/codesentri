import type { FileChange } from './types.js';

export function buildReviewPrompt(diff: string, files: FileChange[]): string {
  const fileSummary = files
    .map((f) => `  ${f.filename} (+${f.additions}/-${f.deletions}) [${f.status}]`)
    .join('\n');

  return `Review this pull request diff.

## Changed Files
${fileSummary}

## Diff
\`\`\`diff
${diff}
\`\`\`

Analyze the diff and return a JSON array of review comments. If no issues are found, return \`[]\`.`;
}
