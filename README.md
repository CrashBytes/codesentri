# CodeSentri

AI-powered code reviews on every pull request. Catches bugs, security vulnerabilities, performance issues, and anti-patterns before they reach production.

[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-CodeSentri-blue?logo=github)](https://github.com/marketplace/codesentri)
[![License](https://img.shields.io/badge/license-proprietary-lightgrey)]()

## How It Works

1. Install the [GitHub App](https://github.com/apps/codesentri) on your repositories
2. Open a pull request
3. CodeSentri reviews the diff using Claude AI and posts inline comments with severity levels and suggested fixes

Supports both **GitHub** pull requests and **GitLab** merge requests.

## What It Catches

- **Bugs & Logic Errors** — off-by-one errors, null pointer risks, race conditions
- **Security Vulnerabilities** — SQL injection, XSS, auth issues, OWASP Top 10
- **Performance Issues** — N+1 queries, unnecessary allocations, algorithmic complexity
- **Best Practice Violations** — code smells, missing error handling, anti-patterns

Each comment includes a severity level (CRITICAL, WARNING, SUGGESTION, NITPICK) and actionable fix suggestions.

## Pricing

| Plan | Price | Reviews/mo | Model | Max Diff | Max Files |
|------|-------|-----------|-------|----------|-----------|
| Free | $0 | 5 | Haiku | 30k chars | 20 |
| Pro | $19 | 100 | Sonnet | 100k chars | 100 |
| Team | $49 | 500 | Sonnet | 100k chars | 100 |
| Enterprise | Custom | Unlimited | Sonnet | 100k chars | 200 |

## Tech Stack

- **Runtime** — Cloudflare Workers
- **Database** — Cloudflare D1 (production), PostgreSQL (development)
- **AI** — Anthropic Claude API
- **GitHub Integration** — Octokit, webhook-based
- **Payments** — GitHub Marketplace + Stripe
- **Analytics** — Google Analytics 4
- **Testing** — Vitest (~89% statement coverage)
- **Landing Page** — Static HTML on Cloudflare Pages

## Project Structure

```
worker/          Cloudflare Workers production backend
  src/
    index.ts       Main webhook handler
    github.ts      GitHub API & JWT auth
    gitlab.ts      GitLab integration
    reviewer.ts    AI review logic
    usage.ts       Plan-based usage tracking
    plans.ts       Plan configurations
    analytics.ts   GA4 event tracking
src/             Node.js/Express development server
  github/          Webhook & PR handlers
  analysis/        AI review engine & prompt building
  db/              PostgreSQL schema & queries
  billing/         Stripe & Marketplace integration
  dashboard/       Dashboard API routes
site/            Landing page & legal pages
```

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL (for local Express server)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (for Worker development)
- A [GitHub App](https://docs.github.com/en/apps/creating-github-apps) with webhook permissions
- An [Anthropic API key](https://console.anthropic.com/)

### Setup

```bash
npm install
cp .env.example .env
# Fill in required values: GITHUB_APP_ID, GITHUB_PRIVATE_KEY_PATH,
# GITHUB_WEBHOOK_SECRET, ANTHROPIC_API_KEY, DATABASE_URL
```

### Running locally (Express)

```bash
npm run db:migrate
npm run dev

# In another terminal — tunnel webhooks via smee.io
export SMEE_URL=https://smee.io/your-unique-id
npm run tunnel
```

### Running locally (Worker)

```bash
cd worker
npm install
npm run dev   # Starts Wrangler dev server on http://localhost:8787
```

### Testing

```bash
npm test
npm test -- --coverage
```

## GitLab Setup

POST to `/api/gitlab/setup` with:

```json
{
  "project_id": 12345,
  "access_token": "glpat-...",
  "gitlab_url": "https://gitlab.com"
}
```

The webhook is created automatically. Alternatively, add the webhook URL manually in your GitLab project settings.

## Links

- [Website](https://codesentri.com)
- [GitHub Marketplace](https://github.com/marketplace/codesentri)
- [Privacy Policy](https://codesentri.com/privacy)
- [Terms of Service](https://codesentri.com/terms)
