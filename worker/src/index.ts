import type { Env } from './types.js';
import { verifyWebhookSignature, getInstallationToken, githubAPI } from './github.js';
import { reviewDiff } from './reviewer.js';
import { checkUsage } from './usage.js';
import { trackInstall, trackUninstall, trackReview, trackPlanChange } from './analytics.js';
import {
  lookupConnectionBySecret, getMergeRequestDiff, getDiffVersions,
  postMRDiscussion, postMRNote, verifyGitLabWebhookToken, createGitLabConnection, gitlabAPI,
} from './gitlab.js';

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

    if (url.pathname === '/api/gitlab/webhook' && request.method === 'POST') {
      return handleGitLabWebhook(request, env);
    }

    if (url.pathname === '/api/gitlab/setup' && request.method === 'POST') {
      return handleGitLabSetup(request, env);
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

  const payload = JSON.parse(body);

  if (event === 'installation') {
    return handleInstallationEvent(payload, env);
  }

  if (event !== 'pull_request') {
    return Response.json({ ok: true, skipped: 'not a PR event' });
  }

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

    trackReview(env, installationId, repo.full_name, comments.length);

    return Response.json({ ok: true, comments: comments.length });
  } catch (err: any) {
    console.error('Review failed:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function handleInstallationEvent(payload: any, env: Env): Promise<Response> {
  const action = payload.action;
  const installation = payload.installation;
  const account = installation?.account;

  if (!account) {
    return Response.json({ ok: true, skipped: 'no account' });
  }

  const installationId = installation.id;
  const accountLogin = account.login;
  const accountType = account.type;

  if (action === 'created') {
    await env.DB.prepare(
      `INSERT INTO installations (installation_id, account_login, account_type, plan)
       VALUES (?, ?, ?, 'free')
       ON CONFLICT (installation_id) DO UPDATE SET
         account_login = excluded.account_login,
         updated_at = datetime('now')`
    ).bind(installationId, accountLogin, accountType).run();

    trackInstall(env, accountLogin, accountType, installationId);
    console.log(`App installed: ${accountLogin} (${accountType})`);
  } else if (action === 'deleted') {
    await env.DB.prepare(
      `UPDATE installations SET plan = 'free', updated_at = datetime('now')
       WHERE installation_id = ?`
    ).bind(installationId).run();

    trackUninstall(env, accountLogin, installationId);
    console.log(`App uninstalled: ${accountLogin}`);
  }

  return Response.json({ ok: true, action });
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
      trackPlanChange(env, account.login, plan, action);
      break;
    }

    case 'cancelled': {
      await env.DB.prepare(
        `UPDATE installations SET plan = 'free', updated_at = datetime('now')
         WHERE installation_id = ?`
      ).bind(account.id).run();
      trackPlanChange(env, account.login, 'free', 'cancelled');
      break;
    }
  }

  return Response.json({ ok: true });
}

async function handleGitLabWebhook(request: Request, env: Env): Promise<Response> {
  const token = request.headers.get('x-gitlab-token') || '';
  const event = request.headers.get('x-gitlab-event') || '';

  if (!token) {
    return Response.json({ error: 'Missing webhook token' }, { status: 401 });
  }

  if (event !== 'Merge Request Hook') {
    return Response.json({ ok: true, skipped: `event: ${event}` });
  }

  const payload = await request.json() as any;
  const action = payload.object_attributes?.action;

  if (action !== 'open' && action !== 'update') {
    return Response.json({ ok: true, skipped: `action: ${action}` });
  }

  // Look up the connection by webhook secret
  const connection = await lookupConnectionBySecret(env.DB, token);
  if (!connection) {
    return Response.json({ error: 'Unknown webhook token' }, { status: 401 });
  }

  const mrIid = payload.object_attributes.iid;
  const projectId = connection.project_id;
  const projectPath = connection.project_path;

  // Skip bot MRs
  const username = payload.user?.username || '';
  if (username.includes('bot') || username.includes('[bot]')) {
    return Response.json({ ok: true, skipped: 'bot MR' });
  }

  // Check usage
  const planConfig = await checkUsage(env.DB, connection.installation_id);
  if (!planConfig) {
    return Response.json({ ok: true, skipped: 'usage limit reached' });
  }

  try {
    // Fetch diff and files
    const { diff, files } = await getMergeRequestDiff(
      connection.gitlab_url, connection.access_token, projectId, mrIid,
    );

    if (files.length > planConfig.maxFiles) {
      return Response.json({ ok: true, skipped: 'too many files' });
    }

    // Run AI review
    const comments = await reviewDiff(
      env.ANTHROPIC_API_KEY, diff, files, planConfig.model, planConfig.maxDiffSize,
    );

    if (comments.length === 0) {
      await postMRNote(
        connection.gitlab_url, connection.access_token, projectId, mrIid,
        '**CodeSentri** found no issues. Code looks good!',
      );
    } else {
      // Get diff versions for inline comment positioning
      const version = await getDiffVersions(
        connection.gitlab_url, connection.access_token, projectId, mrIid,
      );

      const position = {
        baseSha: version.base_commit_sha,
        startSha: version.start_commit_sha,
        headSha: version.head_commit_sha,
      };

      // Post summary note
      await postMRNote(
        connection.gitlab_url, connection.access_token, projectId, mrIid,
        `**CodeSentri** found ${comments.length} issue${comments.length === 1 ? '' : 's'} to review.`,
      );

      // Post inline comments as discussions
      for (const c of comments) {
        try {
          await postMRDiscussion(
            connection.gitlab_url, connection.access_token, projectId, mrIid,
            { path: c.path, line: c.line, body: formatComment(c) },
            position,
          );
        } catch (err: any) {
          // Individual comment failures shouldn't stop the whole review
          console.error(`Failed to post comment on ${c.path}:${c.line}:`, err.message);
        }
      }
    }

    // Track review
    await env.DB.prepare(
      `INSERT INTO reviews (installation_id, repo, pr_number, comments_count) VALUES (?, ?, ?, ?)`,
    ).bind(connection.installation_id, projectPath, mrIid, comments.length).run();

    trackReview(env, connection.installation_id, projectPath, comments.length);

    return Response.json({ ok: true, comments: comments.length });
  } catch (err: any) {
    console.error('GitLab review failed:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function handleGitLabSetup(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as {
      gitlab_url?: string;
      project_id: number;
      access_token: string;
    };

    const gitlabUrl = (body.gitlab_url || 'https://gitlab.com').replace(/\/+$/, '');
    const { project_id: projectId, access_token: accessToken } = body;

    if (!projectId || !accessToken) {
      return Response.json({ error: 'project_id and access_token are required' }, { status: 400 });
    }

    // Validate the token by fetching project info
    const project = await gitlabAPI(gitlabUrl, accessToken, 'GET', `/projects/${projectId}`) as {
      id: number;
      path_with_namespace: string;
    };

    const projectPath = project.path_with_namespace;

    // Create the connection
    const { installationId, webhookSecret, webhookUrl } = await createGitLabConnection(
      env, gitlabUrl, projectId, projectPath, accessToken,
    );

    // Try to create the webhook on GitLab automatically
    let webhookCreated = false;
    let webhookId: number | null = null;
    try {
      const hook = await gitlabAPI(gitlabUrl, accessToken, 'POST', `/projects/${projectId}/hooks`, {
        url: webhookUrl,
        token: webhookSecret,
        merge_requests_events: true,
        push_events: false,
        enable_ssl_verification: true,
      }) as { id: number };
      webhookId = hook.id;
      webhookCreated = true;

      // Store the webhook ID for cleanup
      await env.DB.prepare(
        `UPDATE gitlab_connections SET webhook_id = ? WHERE gitlab_url = ? AND project_id = ?`,
      ).bind(webhookId, gitlabUrl, projectId).run();
    } catch {
      // Token might not have admin access to create hooks — user can add manually
    }

    return Response.json({
      ok: true,
      installation_id: installationId,
      project: projectPath,
      webhook_created: webhookCreated,
      webhook_url: webhookUrl,
      webhook_secret: webhookCreated ? undefined : webhookSecret,
      manual_setup: webhookCreated ? undefined : {
        message: 'Could not auto-create webhook. Add it manually in GitLab.',
        url: webhookUrl,
        secret_token: webhookSecret,
        trigger: 'Merge request events',
      },
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}

export function formatComment(comment: { severity: string; title: string; message: string; suggestion?: string }): string {
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
