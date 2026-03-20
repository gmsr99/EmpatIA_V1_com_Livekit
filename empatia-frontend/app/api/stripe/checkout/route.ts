import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import pool from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2026-02-25.clover',
});

const PLANS: Record<string, { priceId: string; patientLimit: number; label: string }> = {
  basic: {
    priceId: process.env.STRIPE_PRICE_BASIC ?? '',
    patientLimit: 1,
    label: 'Básico',
  },
  extended: {
    priceId: process.env.STRIPE_PRICE_EXTENDED ?? '',
    patientLimit: 2,
    label: 'Extendido',
  },
  professional: {
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
    patientLimit: 5,
    label: 'Profissional',
  },
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { plan } = await req.json();
  const planConfig = PLANS[plan];
  if (!planConfig) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
  }

  if (!planConfig.priceId) {
    return NextResponse.json(
      { error: 'Stripe não configurado. Configure STRIPE_PRICE_* nas variáveis de ambiente.' },
      { status: 503 }
    );
  }

  const client = await pool.connect();
  try {
    // Get or create Stripe customer
    const cpRes = await client.query(
      'SELECT stripe_customer_id FROM caregiver_profiles WHERE user_id = $1',
      [session.user.id]
    );
    const userRes = await client.query('SELECT email, name FROM users WHERE id = $1', [
      session.user.id,
    ]);
    const user = userRes.rows[0];
    let customerId: string = cpRes.rows[0]?.stripe_customer_id ?? '';

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: session.user.id },
      });
      customerId = customer.id;
      await client.query(
        'UPDATE caregiver_profiles SET stripe_customer_id = $1 WHERE user_id = $2',
        [customerId, session.user.id]
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://cuidadores.empatia-portugal.pt';

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${baseUrl}/cuidador?upgraded=1`,
      cancel_url: `${baseUrl}/cuidador/upgrade`,
      metadata: {
        userId: session.user.id,
        plan,
        patientLimit: String(planConfig.patientLimit),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } finally {
    client.release();
  }
}
