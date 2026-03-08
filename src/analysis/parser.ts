import type { ReviewComment } from './types.js';
import { logger } from '../logger.js';

export function parseReviewResponse(text: string): ReviewComment[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.info('No JSON array found in response — assuming clean review');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      logger.warn('Parsed response is not an array');
      return [];
    }

    return parsed
      .filter((item: any) => {
        return (
          typeof item.path === 'string' &&
          typeof item.line === 'number' &&
          ['critical', 'warning', 'suggestion', 'nitpick'].includes(item.severity) &&
          typeof item.title === 'string' &&
          typeof item.message === 'string'
        );
      })
      .map((item: any) => ({
        path: item.path,
        line: item.line,
        severity: item.severity,
        title: item.title,
        message: item.message,
        suggestion: item.suggestion || undefined,
      }));
  } catch (err) {
    logger.error({ err, text: text.slice(0, 500) }, 'Failed to parse AI review response');
    return [];
  }
}
