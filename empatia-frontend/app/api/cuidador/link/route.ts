import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { accessCode } = await req.json();
  if (!accessCode?.trim()) {
    return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const patientRes = await client.query(
      'SELECT id, name FROM users WHERE upper(access_code) = upper($1)',
      [accessCode.trim()]
    );

    if (patientRes.rows.length === 0) {
      return NextResponse.json({ error: 'Código não encontrado' }, { status: 404 });
    }

    const patient = patientRes.rows[0];

    if (patient.id === session.user.id) {
      return NextResponse.json({ error: 'Não pode adicionar-se a si próprio' }, { status: 400 });
    }

    await client.query(
      `INSERT INTO caregiver_patients (caregiver_id, patient_id)
       VALUES ($1, $2)
       ON CONFLICT (caregiver_id, patient_id) DO NOTHING`,
      [session.user.id, patient.id]
    );

    return NextResponse.json({ success: true, patient: { id: patient.id, name: patient.name } });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { patientId } = await req.json();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId obrigatório' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query(
      'DELETE FROM caregiver_patients WHERE caregiver_id = $1 AND patient_id = $2',
      [session.user.id, patientId]
    );
    return NextResponse.json({ success: true });
  } finally {
    client.release();
  }
}
