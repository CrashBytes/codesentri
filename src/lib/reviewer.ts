import Anthropic from '@anthropic-ai/sdk'
import { REVIEW_SYSTEM_PROMPT } from './constants'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface ReviewComment {
  path: string
  line: number
  severity: 'critical' | 'warning' | 'suggestion'
  body: string
}

export interface ReviewResult {
  summary: string
  comments: ReviewComment[]
  tokenUsage: number
}

export async function reviewDiff(diff: string, prTitle: string, prBody?: string): Promise<ReviewResult> {
  const userMessage = `## Pull Request: ${prTitle}
${prBody ? `\n### Description:\n${prBody}\n` : ''}
### Diff:
\`\`\`diff
${truncateDiff(diff)}
\`\`\``

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: REVIEW_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const tokenUsage = (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0)

  // Parse JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { summary: text, comments: [], tokenUsage }
  }

  const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])

  return {
    summary: parsed.summary || '',
    comments: (parsed.comments || []).map((c: any) => ({
      path: c.path,
      line: c.line,
      severity: c.severity || 'suggestion',
      body: formatComment(c),
    })),
    tokenUsage,
  }
}

function formatComment(comment: { severity: string; body: string }): string {
  const icon = comment.severity === 'critical' ? '🔴' : comment.severity === 'warning' ? '🟡' : '🔵'
  return `${icon} **${comment.severity.toUpperCase()}**: ${comment.body}`
}

function truncateDiff(diff: string, maxChars = 100_000): string {
  if (diff.length <= maxChars) return diff
  return diff.slice(0, maxChars) + '\n\n... [diff truncated — too large for review]'
}
