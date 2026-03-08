import type { Env } from './types.js';

export async function gitlabAPI(
  baseUrl: string,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const headers: Record<string, string> = {
    'PRIVATE-TOKEN': token,
    'Content-Type': 'application/json',
  };

  const resp = await fetch(`${baseUrl}/api/v4${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitLab API error: ${resp.status} ${text}`);
  }

  return resp.json();
}

interface GitLabChange {
  old_path: string;
  new_path: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
  diff: string;
}

interface GitLabMRChanges {
  changes: GitLabChange[];
}

interface GitLabDiffVersion {
  id: number;
  base_commit_sha: string;
  start_commit_sha: string;
  head_commit_sha: string;
}

export async function getMergeRequestDiff(
  baseUrl: string,
  token: string,
  projectId: number,
  mrIid: number,
): Promise<{ diff: string; files: Array<{ filename: string; additions: number; deletions: number; status: string }> }> {
  const data = await gitlabAPI(baseUrl, token, 'GET',
    `/projects/${projectId}/merge_requests/${mrIid}/changes`,
  ) as GitLabMRChanges;

  const files: Array<{ filename: string; additions: number; deletions: number; status: string }> = [];
  const diffParts: string[] = [];

  for (const change of data.changes) {
    let status = 'modified';
    if (change.new_file) status = 'added';
    else if (change.deleted_file) status = 'removed';
    else if (change.renamed_file) status = 'renamed';

    const additions = (change.diff.match(/^\+[^+]/gm) || []).length;
    const deletions = (change.diff.match(/^-[^-]/gm) || []).length;

    files.push({
      filename: change.new_path,
      additions,
      deletions,
      status,
    });

    diffParts.push(`diff --git a/${change.old_path} b/${change.new_path}\n${change.diff}`);
  }

  return { diff: diffParts.join('\n'), files };
}

export async function getDiffVersions(
  baseUrl: string,
  token: string,
  projectId: number,
  mrIid: number,
): Promise<GitLabDiffVersion> {
  const versions = await gitlabAPI(baseUrl, token, 'GET',
    `/projects/${projectId}/merge_requests/${mrIid}/versions`,
  ) as GitLabDiffVersion[];

  if (!versions.length) {
    throw new Error('No diff versions found for this merge request');
  }

  return versions[0];
}

export async function postMRDiscussion(
  baseUrl: string,
  token: string,
  projectId: number,
  mrIid: number,
  comment: { path: string; line: number; body: string },
  position: { baseSha: string; startSha: string; headSha: string },
): Promise<void> {
  await gitlabAPI(baseUrl, token, 'POST',
    `/projects/${projectId}/merge_requests/${mrIid}/discussions`,
    {
      body: comment.body,
      position: {
        position_type: 'text',
        base_sha: position.baseSha,
        start_sha: position.startSha,
        head_sha: position.headSha,
        old_path: comment.path,
        new_path: comment.path,
        new_line: comment.line,
      },
    },
  );
}

export async function postMRNote(
  baseUrl: string,
  token: string,
  projectId: number,
  mrIid: number,
  body: string,
): Promise<void> {
  await gitlabAPI(baseUrl, token, 'POST',
    `/projects/${projectId}/merge_requests/${mrIid}/notes`,
    { body },
  );
}

export function verifyGitLabWebhookToken(expected: string, received: string): boolean {
  if (!expected || !received) return false;
  return expected === received;
}

export async function lookupConnectionBySecret(
  db: D1Database,
  webhookSecret: string,
): Promise<{
  installation_id: number;
  gitlab_url: string;
  project_id: number;
  project_path: string;
  access_token: string;
} | null> {
  return db.prepare(
    `SELECT gc.installation_id, gc.gitlab_url, gc.project_id, gc.project_path, gc.access_token
     FROM gitlab_connections gc
     WHERE gc.webhook_secret = ?`,
  ).bind(webhookSecret).first();
}

export async function createGitLabConnection(
  env: Env,
  gitlabUrl: string,
  projectId: number,
  projectPath: string,
  accessToken: string,
): Promise<{ installationId: number; webhookSecret: string; webhookUrl: string }> {
  const webhookSecret = crypto.randomUUID();

  // Create a synthetic installation for billing/usage tracking
  const result = await env.DB.prepare(
    `INSERT INTO installations (installation_id, account_login, account_type, plan, platform)
     VALUES (?, ?, 'GitLab', 'free', 'gitlab')
     ON CONFLICT (installation_id) DO UPDATE SET
       account_login = excluded.account_login,
       updated_at = datetime('now')
     RETURNING installation_id`,
  ).bind(
    // Use a hash of gitlab_url + project_id as a synthetic installation_id
    hashInstallationId(gitlabUrl, projectId),
    projectPath,
  ).first<{ installation_id: number }>();

  const installationId = result!.installation_id;

  await env.DB.prepare(
    `INSERT INTO gitlab_connections (installation_id, gitlab_url, project_id, project_path, access_token, webhook_secret)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (gitlab_url, project_id) DO UPDATE SET
       access_token = excluded.access_token,
       webhook_secret = excluded.webhook_secret,
       updated_at = datetime('now')`,
  ).bind(installationId, gitlabUrl, projectId, projectPath, accessToken, webhookSecret).run();

  const workerUrl = 'https://codesentri.michael-eakins.workers.dev';
  const webhookUrl = `${workerUrl}/api/gitlab/webhook`;

  return { installationId, webhookSecret, webhookUrl };
}

function hashInstallationId(gitlabUrl: string, projectId: number): number {
  // Generate a stable integer from gitlab_url + project_id
  // Use a simple hash to avoid collisions with GitHub installation IDs (which are large ints)
  // Offset by 10_000_000 to avoid overlap with GitHub IDs
  let hash = 10_000_000;
  const str = `${gitlabUrl}:${projectId}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
