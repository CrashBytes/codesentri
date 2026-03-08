import type { Env } from './types.js';
import { verifyWebhookSignature, getInstallationToken, githubAPI } from './github.js';
import { reviewDiff } from './reviewer.js';
import { checkUsage } from './usage.js';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    if (url.pathname === '/api/webhook' && request.method === 'POST') {
      return handleGitHubWebhook(request, env);
    }

    if (url.pathname === '/api/marketplace/webhook' && request.method === 'POST') {
      return handleMarketplaceWebhook(request, env);
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
};

async function handleGitHubWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get('x-hub-signature-256') || '';
  const event = request.headers.get('x-github-event') || '';

  const valid = await verifyWebhookSignature(env.GITHUB_WEBHOOK_SECRET, body, signature);
  if (!valid) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (event !== 'pull_request') {
    return Response.json({ ok: true, skipped: 'not a PR event' });
  }

  const payload = JSON.parse(body);
  const action = payload.action;

  if (action !== 'opened' && action !== 'synchronize') {
    return Response.json({ ok: true, skipped: `action: ${action}` });
  }

  // Skip bot PRs
  if (payload.pull_request?.user?.type === 'Bot') {
    return Response.json({ ok: true, skipped: 'bot PR' });
  }

  const installationId = payload.installation?.id;
  if (!installationId) {
    return Response.json({ error: 'No installation' }, { status: 400 });
  }

  // Check usage and get plan config
  const planConfig = await checkUsage(env.DB, installationId);
  if (!planConfig) {
    return Response.json({ ok: true, skipped: 'usage limit reached' });
  }

  const pr = payload.pull_request;
  const repo = payload.repository;
  const owner = repo.owner.login;
  const repoName = repo.name;
  const prNumber = pr.number;

  try {
    const token = await getInstallationToken(env, installationId);

    // Fetch changed files
    const files = await githubAPI(token, 'GET',
      `/repos/${owner}/${repoName}/pulls/${prNumber}/files`
    ) as Array<{ filename: string; additions: number; deletions: number; status: string; patch?: string }>;

    // Check file count limit
    if (files.length > planConfig.maxFiles) {
      return Response.json({ ok: true, skipped: 'too many files' });
    }

    // Fetch diff
    const diff = await githubAPI(token, 'GET',
      `/repos/${owner}/${repoName}/pulls/${prNumber}`,
      undefined,
      'application/vnd.github.diff'
    ) as string;

    // Run AI review
    const comments = await reviewDiff(
      env.ANTHROPIC_API_KEY, diff, files, planConfig.model, planConfig.maxDiffSize
    );

    if (comments.length === 0) {
      await githubAPI(token, 'POST',
        `/repos/${owner}/${repoName}/pulls/${prNumber}/reviews`,
        { event: 'APPROVE', body: '**CodeSentri** found no issues. Code looks good!' }
      );
    } else {
      const ghComments = comments.map(c => ({
        path: c.path,
        line: c.line,
        side: 'RIGHT',
        body: formatComment(c),
      }));

      await githubAPI(token, 'POST',
        `/repos/${owner}/${repoName}/pulls/${prNumber}/reviews`,
        {
          commit_id: pr.head.sha,
          event: 'COMMENT',
          body: `**CodeSentri** found ${comments.length} issue${comments.length === 1 ? '' : 's'} to review.`,
          comments: ghComments,
        }
      );
    }

    // Track review
    await env.DB.prepare(
      `INSERT INTO reviews (installation_id, repo, pr_number, comments_count) VALUES (?, ?, ?, ?)`
    ).bind(installationId, repo.full_name, prNumber, comments.length).run();

    return Response.json({ ok: true, comments: comments.length });
  } catch (err: any) {
    console.error('Review failed:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function handleMarketplaceWebhook(request: Request, env: Env): Promise<Response> {
  const payload = await request.json() as any;
  const { action, marketplace_purchase: purchase } = payload;
  const account = purchase.account;

  const planName = purchase.plan.name.toLowerCase();
  let plan = 'free';
  if (planName.includes('team')) plan = 'team';
  else if (planName.includes('pro')) plan = 'pro';

  switch (action) {
    case 'purchased':
    case 'changed': {
      await env.DB.prepare(
        `INSERT INTO installations (installation_id, account_login, account_type, plan)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (installation_id) DO UPDATE SET
           plan = excluded.plan,
           account_login = excluded.account_login,
           updated_at = datetime('now')`
      ).bind(account.id, account.login, account.type, plan).run();
      break;
    }

    case 'cancelled': {
      await env.DB.prepare(
        `UPDATE installations SET plan = 'free', updated_at = datetime('now')
         WHERE installation_id = ?`
      ).bind(account.id).run();
      break;
    }
  }

  return Response.json({ ok: true });
}

function formatComment(comment: { severity: string; title: string; message: string; suggestion?: string }): string {
  const severityLabel = {
    critical: '[CRITICAL]',
    warning: '[WARNING]',
    suggestion: '[SUGGESTION]',
    nitpick: '[NITPICK]',
  }[comment.severity] || '[INFO]';

  let body = `${severityLabel} **${comment.title}**\n\n${comment.message}`;

  if (comment.suggestion) {
    body += `\n\n**Suggested fix:**\n\`\`\`suggestion\n${comment.suggestion}\n\`\`\``;
  }

  return body;
}
