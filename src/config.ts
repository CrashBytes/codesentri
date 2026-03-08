import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function lazy(key: string): string {
  return process.env[key] || '';
}

function lazyFile(pathKey: string, fallback: string): () => string {
  let cached: string | undefined;
  return () => {
    if (!cached) cached = readFileSync(process.env[pathKey] || fallback, 'utf-8');
    return cached;
  };
}

const getPrivateKey = lazyFile('GITHUB_PRIVATE_KEY_PATH', './private-key.pem');

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  github: {
    get appId() { return required('GITHUB_APP_ID'); },
    get privateKey() { return getPrivateKey(); },
    get webhookSecret() { return required('GITHUB_WEBHOOK_SECRET'); },
  },

  anthropic: {
    get apiKey() { return required('ANTHROPIC_API_KEY'); },
  },

  database: {
    get url() { return required('DATABASE_URL'); },
  },

  stripe: {
    get secretKey() { return lazy('STRIPE_SECRET_KEY'); },
    get webhookSecret() { return lazy('STRIPE_WEBHOOK_SECRET'); },
    get priceIdPro() { return lazy('STRIPE_PRICE_ID_PRO'); },
  },
};
