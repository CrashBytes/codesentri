import { getInstallationOctokit } from './app.js';
import { reviewDiff } from '../analysis/reviewer.js';
import { postReviewComments } from './comments.js';
import { checkUsage } from '../billing/usage.js';
import { db } from '../db/client.js';
import { logger } from '../logger.js';

interface PRPayload {
  action: string;
  pull_request: {
    number: number;
    head: { sha: string };
  };
  repository: {
    name: string;
    full_name: string;
    owner: { login: string };
  };
  installation?: { id: number };
}

export async function handlePullRequest(payload: PRPayload) {
  const { pull_request: pr, repository, installation } = payload;
  if (!installation) {
    logger.warn('No installation found on webhook payload');
    return;
  }

  const owner = repository.owner.login;
  const repo = repository.name;
  const prNumber = pr.number;

  const allowed = await checkUsage(installation.id);
  if (!allowed) {
    logger.info({ installationId: installation.id }, 'Usage limit reached, skipping review');
    return;
  }

  const octokit = await getInstallationOctokit(installation.id);

  // Fetch the PR diff
  const { data: diff } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: 'diff' },
  });

  // Fetch changed files for context
  const { data: files } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
    owner,
    repo,
    pull_number: prNumber,
  });

  logger.info({ owner, repo, prNumber, filesChanged: files.length }, 'Analyzing PR');

  const comments = await reviewDiff(diff as unknown as string, files);

  if (comments.length === 0) {
    logger.info({ owner, repo, prNumber }, 'No issues found');
    await octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
      owner,
      repo,
      pull_number: prNumber,
      event: 'APPROVE',
      body: '**CodeSentri** found no issues. Code looks good!',
    });
  } else {
    await postReviewComments(octokit, { owner, repo, prNumber, comments, commitSha: pr.head.sha });
  }

  // Track usage
  await db.query(
    `INSERT INTO reviews (installation_id, repo, pr_number, comments_count)
     VALUES ($1, $2, $3, $4)`,
    [installation.id, repository.full_name, prNumber, comments.length]
  );
}
