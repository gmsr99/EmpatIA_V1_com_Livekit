import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/db';

// GET /api/cuidador/patient-profile?patientId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get('patientId');
  if (!patientId) {
    return NextResponse.json({ error: 'patientId obrigatório' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Verify caregiver owns this patient
    const access = await client.query(
      'SELECT 1 FROM users WHERE id = $1 AND caregiver_id = $2',
      [patientId, session.user.id]
    );
    if (access.rows.length === 0) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const res = await client.query('SELECT * FROM patient_profiles WHERE user_id = $1', [
      patientId,
    ]);
    return NextResponse.json({ profile: res.rows[0] ?? {} });
  } finally {
    client.release();
  }
}

// PUT /api/cuidador/patient-profile
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { patientId, profile } = await req.json();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId obrigatório' }, { status: 400 });
  }

  function toLines(val: unknown): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return (val as string[]).filter(Boolean);
    return String(val)
      .split('\n')
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  const client = await pool.connect();
  try {
    // Verify caregiver owns this patient
    const access = await client.query(
      'SELECT 1 FROM users WHERE id = $1 AND caregiver_id = $2',
      [patientId, session.user.id]
    );
    if (access.rows.length === 0) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    await client.query(
      `INSERT INTO patient_profiles
         (user_id, full_name, gender, age, location, profession_retired, medications, interests, family, religious, notes, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         full_name          = EXCLUDED.full_name,
         gender             = EXCLUDED.gender,
         age                = EXCLUDED.age,
         location           = EXCLUDED.location,
         profession_retired = EXCLUDED.profession_retired,
         medications        = EXCLUDED.medications,
         interests          = EXCLUDED.interests,
         family             = EXCLUDED.family,
         religious          = EXCLUDED.religious,
         notes              = EXCLUDED.notes,
         updated_at         = NOW()`,
      [
        patientId,
        profile.full_name?.trim() || null,
        profile.gender || null,
        profile.age ? Number(profile.age) : null,
        profile.location?.trim() || null,
        profile.profession_retired?.trim() || null,
        toLines(profile.medications),
        toLines(profile.interests),
        toLines(profile.family),
        profile.religious?.trim() || null,
        profile.notes?.trim() || null,
      ]
    );

    return NextResponse.json({ success: true });
  } finally {
    client.release();
  }
}
