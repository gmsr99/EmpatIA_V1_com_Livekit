import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import pool from '@/lib/db';

function toLines(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return (val as string[]).filter(Boolean);
  return String(val)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const caregiverId = session.user.id;
  const { name, username, password, profile } = await req.json();

  if (!name || !username || !password) {
    return NextResponse.json(
      { error: 'Nome, username e palavra-passe são obrigatórios' },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    // Check subscription limit
    const limitRes = await client.query(
      `SELECT cp.patient_limit,
              (SELECT COUNT(*) FROM users u2 WHERE u2.caregiver_id = $1) AS current_count
       FROM caregiver_profiles cp
       WHERE cp.user_id = $1`,
      [caregiverId]
    );

    const row = limitRes.rows[0];
    const patientLimit = Number(row?.patient_limit ?? 1);
    const currentCount = Number(row?.current_count ?? 0);

    if (currentCount >= patientLimit) {
      return NextResponse.json(
        {
          error: `Limite atingido. O seu plano permite ${patientLimit} utente${patientLimit !== 1 ? 's' : ''}. Faça upgrade para adicionar mais.`,
          upgrade: true,
        },
        { status: 403 }
      );
    }

    // Check username availability
    const usernameCheck = await client.query('SELECT 1 FROM users WHERE username = $1', [
      username.toLowerCase().trim(),
    ]);
    if (usernameCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'Este nome de utilizador já está em uso' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const res = await client.query(
      `INSERT INTO users (name, username, password, user_type, caregiver_id)
       VALUES ($1, $2, $3, 'patient', $4)
       RETURNING id, name, username`,
      [name.trim(), username.toLowerCase().trim(), hashedPassword, caregiverId]
    );
    const newPatient = res.rows[0];

    // Save profile to patient_profiles
    await client.query(
      `INSERT INTO patient_profiles
         (user_id, full_name, gender, age, location, profession_retired,
          medications, interests, family, religious, notes, updated_at)
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
        newPatient.id,
        (profile?.full_name ?? name)?.trim() || null,
        profile?.gender || null,
        profile?.age ? Number(profile.age) : null,
        profile?.location?.trim() || null,
        profile?.profession_retired?.trim() || null,
        toLines(profile?.medications),
        toLines(profile?.interests),
        toLines(profile?.family),
        profile?.religious?.trim() || null,
        profile?.notes?.trim() || null,
      ]
    );

    return NextResponse.json({ patient: newPatient });
  } catch (err) {
    console.error('Create patient error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  } finally {
    client.release();
  }
}
