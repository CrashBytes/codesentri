import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { fetchPRDiff, postReviewComment } from '@/lib/github'
import { reviewDiff } from '@/lib/reviewer'
import { PLANS } from '@/lib/constants'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  const event = request.headers.get('x-github-event')

  // Verify webhook signature
  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)

  // Handle installation events
  if (event === 'installation') {
    return handleInstallation(payload)
  }

  // Handle PR events
  if (event === 'pull_request' && ['opened', 'synchronize'].includes(payload.action)) {
    // Process async — respond immediately to GitHub
    processReview(payload).catch(console.error)
    return NextResponse.json({ status: 'processing' })
  }

  return NextResponse.json({ status: 'ignored' })
}

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature || !process.env.GITHUB_WEBHOOK_SECRET) return false
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

async function handleInstallation(payload: any) {
  const installationId = payload.installation.id
  const action = payload.action // 'created' or 'deleted'

  if (action === 'created') {
    // Store installation — we'll link it to a user when they log in
    await prisma.installation.upsert({
      where: { githubInstallationId: installationId },
      create: { githubInstallationId: installationId },
      update: {},
    })

    // Add repos from the installation
    if (payload.repositories) {
      for (const repo of payload.repositories) {
        // Find or create installation first
        const installation = await prisma.installation.findUnique({
          where: { githubInstallationId: installationId },
        })
        if (installation) {
          await prisma.repository.upsert({
            where: { githubRepoId: repo.id },
            create: {
              installationId: installation.id,
              githubRepoId: repo.id,
              fullName: repo.full_name,
            },
            update: { fullName: repo.full_name },
          })
        }
      }
    }
  }

  if (action === 'deleted') {
    await prisma.installation.deleteMany({
      where: { githubInstallationId: installationId },
    })
  }

  return NextResponse.json({ status: 'ok' })
}

async function processReview(payload: any) {
  const installationId = payload.installation.id
  const pr = payload.pull_request
  const repo = payload.repository
  const [owner, repoName] = repo.full_name.split('/')

  // Find the installation and check limits
  const installation = await prisma.installation.findUnique({
    where: { githubInstallationId: installationId },
    include: { user: true },
  })

  if (!installation) return

  // Check review limits for user's plan
  const plan = installation.user?.plan || 'FREE'
  const limits = PLANS[plan]

  if (limits.maxReviewsPerMonth !== -1) {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const reviewCount = await prisma.review.count({
      where: {
        repository: { installation: { id: installation.id } },
        createdAt: { gte: monthStart },
      },
    })

    if (reviewCount >= limits.maxReviewsPerMonth) return // silently skip — over limit
  }

  // Find or create repo record
  const repository = await prisma.repository.findFirst({
    where: { githubRepoId: repo.id },
  })
  if (!repository || !repository.isActive) return

  // Create review record
  const review = await prisma.review.create({
    data: {
      repositoryId: repository.id,
      prNumber: pr.number,
      prTitle: pr.title,
      commitSha: pr.head.sha,
      status: 'REVIEWING',
    },
  })

  try {
    // Fetch diff
    const diff = await fetchPRDiff(installationId, owner, repoName, pr.number)

    // Run AI review
    const result = await reviewDiff(diff, pr.title, pr.body)

    // Post review comments to GitHub
    if (result.comments.length > 0) {
      await postReviewComment(
        installationId,
        owner,
        repoName,
        pr.number,
        `## CodeSentri Review\n\n${result.summary}`,
        pr.head.sha,
        result.comments.map(c => ({
          path: c.path,
          line: c.line,
          body: c.body,
        }))
      )
    } else {
      // Post summary-only comment if no issues
      // Use the issues API instead of review API for summary-only
      const { getInstallationToken, createOctokit } = await import('@/lib/github')
      const token = await getInstallationToken(installationId)
      const octokit = createOctokit(token)
      await octokit.rest.issues.createComment({
        owner, repo: repoName, issue_number: pr.number,
        body: `## CodeSentri Review ✅\n\n${result.summary}`,
      })
    }

    // Update review record
    await prisma.review.update({
      where: { id: review.id },
      data: {
        status: 'COMPLETED',
        summary: result.summary,
        commentsCount: result.comments.length,
        tokenUsage: result.tokenUsage,
        completedAt: new Date(),
      },
    })
  } catch (error) {
    console.error('Review failed:', error)
    await prisma.review.update({
      where: { id: review.id },
      data: { status: 'FAILED' },
    })
  }
}
