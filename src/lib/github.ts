import { Octokit } from 'octokit'

export function createOctokit(token: string) {
  return new Octokit({ auth: token })
}

export async function getInstallationToken(installationId: number): Promise<string> {
  // Create a GitHub App JWT, then exchange for installation token
  // Uses env vars: GITHUB_APP_ID, GITHUB_PRIVATE_KEY
  const { createAppAuth } = await import('@octokit/auth-app')
  const auth = createAppAuth({
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_PRIVATE_KEY!,
    installationId,
  })
  const { token } = await auth({ type: 'installation' })
  return token
}

export async function fetchPRDiff(installationId: number, owner: string, repo: string, prNumber: number): Promise<string> {
  const token = await getInstallationToken(installationId)
  const octokit = createOctokit(token)
  const { data } = await octokit.rest.pulls.get({
    owner, repo, pull_number: prNumber,
    mediaType: { format: 'diff' }
  })
  return data as unknown as string
}

export async function postReviewComment(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
  commitId: string,
  comments: Array<{ path: string; line: number; body: string }>
) {
  const token = await getInstallationToken(installationId)
  const octokit = createOctokit(token)
  await octokit.rest.pulls.createReview({
    owner, repo, pull_number: prNumber,
    commit_id: commitId,
    body,
    event: 'COMMENT',
    comments,
  })
}
