import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/db';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { minutes } = await req.json();
  const mins = Math.ceil(Number(minutes));
  if (!mins || mins <= 0) {
    return NextResponse.json({ ok: true });
  }

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO patient_usage (patient_id, year_month, minutes_used)
       VALUES ($1, TO_CHAR(NOW(), 'YYYY-MM'), $2)
       ON CONFLICT (patient_id, year_month)
       DO UPDATE SET minutes_used = patient_usage.minutes_used + EXCLUDED.minutes_used`,
      [session.user.id, mins]
    );
    return NextResponse.json({ ok: true });
  } finally {
    client.release();
  }
}
