import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

function generateAccessCode(): string {
  // 6-char uppercase alphanumeric, no ambiguous chars (0/O, 1/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
}

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const accessCode = generateAccessCode();

    const client = await pool.connect();
    try {
      const res = await client.query(
        'INSERT INTO users (name, email, password, access_code, user_type) VALUES ($1, $2, $3, $4, $5) RETURNING id, email',
        [name, email, hashedPassword, accessCode, 'patient']
      );

      const newUser = res.rows[0];

      const n8nUrl = process.env.N8N_WEBHOOK_URL;
      if (n8nUrl) {
        fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newUser.id,
            email: newUser.email,
            name,
            event: 'user_registered',
            timestamp: new Date().toISOString(),
          }),
        }).catch((err) => console.error('Error calling n8n:', err));
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
