import type { Octokit } from 'octokit';
import type { ReviewComment } from '../analysis/types.js';
import { logger } from '../logger.js';

interface PostReviewParams {
  owner: string;
  repo: string;
  prNumber: number;
  comments: ReviewComment[];
  commitSha: string;
}

export async function postReviewComments(
  octokit: Octokit,
  { owner, repo, prNumber, comments, commitSha }: PostReviewParams
) {
  const ghComments = comments.map((c) => ({
    path: c.path,
    line: c.line,
    side: 'RIGHT' as const,
    body: formatComment(c),
  }));

  try {
    await octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
      owner,
      repo,
      pull_number: prNumber,
      commit_id: commitSha,
      event: 'COMMENT',
      body: `**CodeSentri** found ${comments.length} issue${comments.length === 1 ? '' : 's'} to review.`,
      comments: ghComments,
    });

    logger.info({ owner, repo, prNumber, count: comments.length }, 'Posted review comments');
  } catch (err) {
    logger.error({ err, owner, repo, prNumber }, 'Failed to post review');
    throw err;
  }
}

function formatComment(comment: ReviewComment): string {
  const severityIcon = {
    critical: '[CRITICAL]',
    warning: '[WARNING]',
    suggestion: '[SUGGESTION]',
    nitpick: '[NITPICK]',
  }[comment.severity];

  let body = `${severityIcon} **${comment.title}**\n\n${comment.message}`;

  if (comment.suggestion) {
    body += `\n\n**Suggested fix:**\n\`\`\`suggestion\n${comment.suggestion}\n\`\`\``;
  }

  return body;
}
