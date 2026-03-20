import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ userType: null }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query('SELECT user_type FROM users WHERE id = $1', [session.user.id]);
    return NextResponse.json({ userType: res.rows[0]?.user_type ?? 'patient' });
  } finally {
    client.release();
  }
}
