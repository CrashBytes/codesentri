CREATE TABLE IF NOT EXISTS installations (
  id SERIAL PRIMARY KEY,
  installation_id INTEGER UNIQUE NOT NULL,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'Organization',
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  reviews_this_month INTEGER NOT NULL DEFAULT 0,
  month_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()) + INTERVAL '1 month',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  installation_id INTEGER NOT NULL,
  repo TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repo_configs (
  id SERIAL PRIMARY KEY,
  installation_id INTEGER NOT NULL,
  repo TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ignore_patterns TEXT[] DEFAULT '{}',
  review_style TEXT NOT NULL DEFAULT 'thorough',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (installation_id, repo)
);

CREATE INDEX IF NOT EXISTS idx_reviews_installation ON reviews (installation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_installations_gh ON installations (installation_id);
