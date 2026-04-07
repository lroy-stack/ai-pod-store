import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable');
  }

  stripeClient = new Stripe(stripeSecretKey, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  });

  console.info('[Stripe] Client initialized');
  return stripeClient;
}
