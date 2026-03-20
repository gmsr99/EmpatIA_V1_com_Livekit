import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

const PLAN_CONFIG: Record<string, { patientLimit: number; hasTrial: boolean }> = {
  basic: { patientLimit: 1, hasTrial: true },
  extended: { patientLimit: 2, hasTrial: false },
  professional: { patientLimit: 5, hasTrial: false },
};

export async function POST(req: Request) {
  try {
    const { name, email, password, user_type, plan } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
    }

    if (user_type !== 'caregiver') {
      return NextResponse.json(
        { message: 'Patient accounts are created by caregivers from the dashboard.' },
        { status: 400 }
      );
    }

    const selectedPlan = plan && PLAN_CONFIG[plan] ? plan : 'basic';
    const { patientLimit, hasTrial } = PLAN_CONFIG[selectedPlan];

    const hashedPassword = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    try {
      const res = await client.query(
        'INSERT INTO users (name, email, password, user_type) VALUES ($1, $2, $3, $4) RETURNING id, email',
        [name, email, hashedPassword, 'caregiver']
      );
      const newUser = res.rows[0];

      // Create caregiver profile with plan + trial if applicable
      const trialEnd = hasTrial ? new Date(Date.now() + 15 * 86_400_000) : null;
      const subscriptionStatus = hasTrial ? 'active' : 'pending_payment';

      await client.query(
        `INSERT INTO caregiver_profiles
           (user_id, subscription_tier, subscription_status, trial_ends_at, patient_limit)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO NOTHING`,
        [newUser.id, selectedPlan, subscriptionStatus, trialEnd, patientLimit]
      );

      const n8nUrl = process.env.N8N_WEBHOOK_URL;
      if (n8nUrl) {
        fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newUser.id,
            email: newUser.email,
            name,
            user_type: 'caregiver',
            plan: selectedPlan,
            event: 'user_registered',
            timestamp: new Date().toISOString(),
          }),
        }).catch((err) => console.error('n8n webhook error:', err));
      }

      return NextResponse.json(newUser);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any).code === '23505') {
        return NextResponse.json({ message: 'Email already exists' }, { status: 400 });
      }
      console.error(err);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Registration Error:', error);
    return NextResponse.json(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { message: (error as any).message || 'Error executing request' },
      { status: 500 }
    );
  }
}
