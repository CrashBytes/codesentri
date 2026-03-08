import type { Env } from './types.js';

interface GA4Event {
  name: string;
  params: Record<string, string | number>;
}

export async function trackEvent(env: Env, event: GA4Event): Promise<void> {
  if (!env.GA4_MEASUREMENT_ID || !env.GA4_API_SECRET) return;

  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`,
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: `worker-${event.params.installation_id ?? 'system'}`,
          events: [event],
        }),
      },
    );
  } catch {
    // Fire-and-forget — don't let analytics failures affect the app
  }
}

export function trackInstall(env: Env, accountLogin: string, accountType: string, installationId: number) {
  return trackEvent(env, {
    name: 'app_install',
    params: { account_login: accountLogin, account_type: accountType, installation_id: installationId },
  });
}

export function trackUninstall(env: Env, accountLogin: string, installationId: number) {
  return trackEvent(env, {
    name: 'app_uninstall',
    params: { account_login: accountLogin, installation_id: installationId },
  });
}

export function trackReview(env: Env, installationId: number, repo: string, commentsCount: number) {
  return trackEvent(env, {
    name: 'review_completed',
    params: { installation_id: installationId, repo, comments_count: commentsCount },
  });
}

export function trackPlanChange(env: Env, accountLogin: string, plan: string, action: string) {
  return trackEvent(env, {
    name: 'plan_change',
    params: { account_login: accountLogin, plan, action },
  });
}
