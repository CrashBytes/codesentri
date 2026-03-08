import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbQuery = vi.fn();
vi.mock('../client.js', () => ({
  db: { query: (...args: any[]) => mockDbQuery(...args) },
}));

import { getInstallation, upsertInstallation, incrementUsage, resetMonthlyUsage, getRepoConfig } from '../queries.js';

describe('database queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstallation', () => {
    it('returns installation when found', async () => {
      const installation = { installation_id: 1, plan: 'pro' };
      mockDbQuery.mockResolvedValue({ rows: [installation] });

      const result = await getInstallation(1);
      expect(result).toEqual(installation);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1],
      );
    });

    it('returns null when not found', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });

      const result = await getInstallation(999);
      expect(result).toBeNull();
    });
  });

  describe('upsertInstallation', () => {
    it('inserts or updates installation', async () => {
      const row = { installation_id: 1, account_login: 'user', account_type: 'User' };
      mockDbQuery.mockResolvedValue({ rows: [row] });

      const result = await upsertInstallation(1, 'user', 'User');
      expect(result).toEqual(row);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        [1, 'user', 'User'],
      );
    });
  });

  describe('incrementUsage', () => {
    it('increments reviews_this_month', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });

      await incrementUsage(1);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('reviews_this_month + 1'),
        [1],
      );
    });
  });

  describe('resetMonthlyUsage', () => {
    it('resets usage for expired months', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });

      await resetMonthlyUsage();
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('reviews_this_month = 0'),
      );
    });
  });

  describe('getRepoConfig', () => {
    it('returns config when found', async () => {
      const config = { installation_id: 1, repo: 'owner/repo', enabled: true };
      mockDbQuery.mockResolvedValue({ rows: [config] });

      const result = await getRepoConfig(1, 'owner/repo');
      expect(result).toEqual(config);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('repo_configs'),
        [1, 'owner/repo'],
      );
    });

    it('returns null when not found', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });

      const result = await getRepoConfig(1, 'owner/repo');
      expect(result).toBeNull();
    });
  });
});
