-- Add platform column to installations
ALTER TABLE installations ADD COLUMN platform TEXT NOT NULL DEFAULT 'github';

-- GitLab connections table
CREATE TABLE IF NOT EXISTS gitlab_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  installation_id INTEGER NOT NULL,
  gitlab_url TEXT NOT NULL DEFAULT 'https://gitlab.com',
  project_id INTEGER NOT NULL,
  project_path TEXT NOT NULL,
  access_token TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  webhook_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (gitlab_url, project_id)
);

CREATE INDEX IF NOT EXISTS idx_gitlab_connections_project ON gitlab_connections (gitlab_url, project_id);
CREATE INDEX IF NOT EXISTS idx_gitlab_connections_secret ON gitlab_connections (webhook_secret);
