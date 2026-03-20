import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import pool from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2026-02-25.clover',
});

const PLAN_LIMITS: Record<string, number> = {
  basic: 1,
  extended: 2,
  professional: 5,
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        const patientLimit = Number(session.metadata?.patientLimit ?? 1);

        if (userId && plan) {
          await client.query(
            `UPDATE caregiver_profiles
             SET stripe_subscription_id = $1,
                 subscription_tier      = $2,
                 subscription_status    = 'active',
                 patient_limit          = $3,
                 trial_ends_at          = NULL
             WHERE user_id = $4`,
            [session.subscription, plan, patientLimit, userId]
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        // Find user by stripe_customer_id
        const userRes = await client.query(
          'SELECT user_id FROM caregiver_profiles WHERE stripe_customer_id = $1',
          [customerId]
        );
        const userId = userRes.rows[0]?.user_id;
        if (!userId) break;

        const status =
          sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status;

        // Determine plan from price ID
        const priceId = sub.items.data[0]?.price?.id ?? '';
        let tier = 'basic';
        if (priceId === process.env.STRIPE_PRICE_EXTENDED) tier = 'extended';
        else if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) tier = 'professional';
        const patientLimit = PLAN_LIMITS[tier] ?? 1;

        await client.query(
          `UPDATE caregiver_profiles
           SET subscription_tier   = $1,
               subscription_status = $2,
               patient_limit       = $3
           WHERE user_id = $4`,
          [tier, status, patientLimit, userId]
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const userRes = await client.query(
          'SELECT user_id FROM caregiver_profiles WHERE stripe_customer_id = $1',
          [customerId]
        );
        const userId = userRes.rows[0]?.user_id;
        if (!userId) break;

        await client.query(
          `UPDATE caregiver_profiles
           SET subscription_status = 'canceled',
               patient_limit       = 0
           WHERE user_id = $1`,
          [userId]
        );
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const userRes = await client.query(
          'SELECT user_id FROM caregiver_profiles WHERE stripe_customer_id = $1',
          [customerId]
        );
        const userId = userRes.rows[0]?.user_id;
        if (!userId) break;

        await client.query(
          `UPDATE caregiver_profiles SET subscription_status = 'past_due' WHERE user_id = $1`,
          [userId]
        );
        break;
      }
    }

    return NextResponse.json({ received: true });
  } finally {
    client.release();
  }
}
