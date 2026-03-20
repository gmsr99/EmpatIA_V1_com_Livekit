import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import pool from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2026-02-25.clover',
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect('/cuidador');
  }

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    return NextResponse.redirect('/cuidador/upgrade');
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT stripe_customer_id FROM caregiver_profiles WHERE user_id = $1',
      [session.user.id]
    );
    const customerId = res.rows[0]?.stripe_customer_id;

    if (!customerId) {
      return NextResponse.redirect('/cuidador/upgrade');
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://cuidadores.empatia-portugal.pt';
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/cuidador`,
    });

    return NextResponse.redirect(portalSession.url);
  } finally {
    client.release();
  }
}
