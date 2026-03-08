import { Request, Response } from 'express';
import Stripe from 'stripe';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { logger } from '../logger.js';

const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey)
  : null;

export async function stripeWebhookHandler(req: Request, res: Response) {
  if (!stripe || !config.stripe.webhookSecret) {
    res.status(501).json({ error: 'Stripe not configured' });
    return;
  }

  const signature = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, config.stripe.webhookSecret);
  } catch (err) {
    logger.error({ err }, 'Stripe webhook signature verification failed');
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const plan = subscription.status === 'active' ? 'pro' : 'free';

      await db.query(
        `UPDATE installations SET plan = $1, stripe_subscription_id = $2, updated_at = NOW()
         WHERE stripe_customer_id = $3`,
        [plan, subscription.id, customerId]
      );
      logger.info({ customerId, plan }, 'Subscription updated');
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await db.query(
        `UPDATE installations SET plan = 'free', stripe_subscription_id = NULL, updated_at = NOW()
         WHERE stripe_customer_id = $1`,
        [customerId]
      );
      logger.info({ customerId }, 'Subscription cancelled, reverted to free');
      break;
    }
  }

  res.json({ received: true });
}

export async function createCheckoutSession(installationId: number, accountLogin: string): Promise<string | null> {
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: config.stripe.priceIdPro, quantity: 1 }],
    metadata: { installationId: String(installationId), accountLogin },
    success_url: `${process.env.DASHBOARD_URL || 'http://localhost:3001'}/billing/success`,
    cancel_url: `${process.env.DASHBOARD_URL || 'http://localhost:3001'}/billing/cancel`,
  });

  return session.url;
}
