import { describe, it, expect } from 'vitest';
import { formatComment } from '../index.js';

describe('formatComment', () => {
  it('formats critical comment', () => {
    const result = formatComment({
      severity: 'critical',
      title: 'SQL Injection',
      message: 'User input is not sanitized.',
    });
    expect(result).toContain('[CRITICAL]');
    expect(result).toContain('**SQL Injection**');
    expect(result).toContain('User input is not sanitized.');
  });

  it('formats warning comment', () => {
    const result = formatComment({
      severity: 'warning',
      title: 'Missing null check',
      message: 'Could throw.',
    });
    expect(result).toContain('[WARNING]');
  });

  it('formats suggestion comment', () => {
    const result = formatComment({
      severity: 'suggestion',
      title: 'Consider refactoring',
      message: 'This could be cleaner.',
    });
    expect(result).toContain('[SUGGESTION]');
  });

  it('formats nitpick comment', () => {
    const result = formatComment({
      severity: 'nitpick',
      title: 'Naming',
      message: 'Variable name unclear.',
    });
    expect(result).toContain('[NITPICK]');
  });

  it('falls back to INFO for unknown severity', () => {
    const result = formatComment({
      severity: 'unknown',
      title: 'Test',
      message: 'Test message.',
    });
    expect(result).toContain('[INFO]');
  });

  it('includes suggestion block when provided', () => {
    const result = formatComment({
      severity: 'warning',
      title: 'Fix',
      message: 'Issue here.',
      suggestion: 'const x = sanitize(input);',
    });
    expect(result).toContain('**Suggested fix:**');
    expect(result).toContain('```suggestion');
    expect(result).toContain('const x = sanitize(input);');
  });

  it('omits suggestion block when not provided', () => {
    const result = formatComment({
      severity: 'warning',
      title: 'Fix',
      message: 'Issue here.',
    });
    expect(result).not.toContain('Suggested fix');
    expect(result).not.toContain('```suggestion');
  });
});
