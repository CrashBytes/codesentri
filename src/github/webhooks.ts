import { Request, Response } from 'express';
import { Webhooks } from '@octokit/webhooks';
import { config } from '../config.js';
import { handlePullRequest } from './handlers.js';
import { logger } from '../logger.js';

const webhooks = new Webhooks({ secret: config.github.webhookSecret });

webhooks.on(['pull_request.opened', 'pull_request.synchronize'], async ({ payload }) => {
  logger.info({
    action: payload.action,
    pr: payload.pull_request.number,
    repo: payload.repository.full_name,
  }, 'PR event received');

  await handlePullRequest(payload);
});

export async function webhookHandler(req: Request, res: Response) {
  try {
    const id = req.headers['x-github-delivery'] as string;
    const event = req.headers['x-github-event'] as string;
    const signature = req.headers['x-hub-signature-256'] as string;

    await webhooks.verifyAndReceive({
      id,
      name: event as any,
      payload: JSON.stringify(req.body),
      signature,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Webhook processing failed');
    res.status(400).json({ error: 'Webhook processing failed' });
  }
}
