import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ChevronRight, Clock, Users } from 'lucide-react';
import { auth } from '@/auth';
import { LinkPatientForm } from '@/components/dashboard/link-patient-form';
import pool from '@/lib/db';

function formatDaysAgo(date: Date | null): string {
  if (!date) return 'Nunca conversou';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `Há ${days} dias`;
  if (days < 30) return `Há ${Math.floor(days / 7)} semana${Math.floor(days / 7) > 1 ? 's' : ''}`;
  return `Há ${Math.floor(days / 30)} mês${Math.floor(days / 30) > 1 ? 'es' : ''}`;
}

function emotionClass(state: string): string {
  const s = state.toLowerCase();
  const pos = ['feliz', 'bem', 'animado', 'contente', 'alegre', 'tranquilo', 'satisfeito'];
  const neg = ['triste', 'mal', 'preocupado', 'ansioso', 'sozinho', 'dores', 'cansado'];
  if (pos.some((w) => s.includes(w))) return 'bg-emerald-500/20 text-emerald-400';
  if (neg.some((w) => s.includes(w))) return 'bg-amber-500/20 text-amber-400';
  return 'bg-white/10 text-white/60';
}

export default async function CuidadorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const client = await pool.connect();
  let patients: Array<{
    id: string;
    name: string;
    last_session: Date | null;
    last_emotional_state: string | null;
    unread_alerts: number;
    total_sessions: number;
  }> = [];

  try {
    const res = await client.query(
      `SELECT
         u.id,
         u.name,
         MAX(ss.created_at)                                           AS last_session,
         (SELECT emotional_state FROM session_summaries
          WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1)     AS last_emotional_state,
         COUNT(DISTINCT ha.id) FILTER (WHERE NOT ha.is_read)         AS unread_alerts,
         COUNT(DISTINCT ss.id)                                        AS total_sessions
       FROM caregiver_patients cp
       JOIN users u             ON u.id = cp.patient_id
       LEFT JOIN session_summaries ss ON ss.user_id = u.id
       LEFT JOIN health_alerts ha     ON ha.user_id = u.id
       WHERE cp.caregiver_id = $1
       GROUP BY u.id, u.name
       ORDER BY last_session DESC NULLS LAST`,
      [session.user.id]
    );
    patients = res.rows;
  } catch (e) {
    console.error('Cuidador page error:', e);
  } finally {
    client.release();
  }

  const totalAlerts = patients.reduce((sum, p) => sum + Number(p.unread_alerts), 0);

  return (
    <div className="min-h-screen px-4 pb-16 pt-24 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Painel de Cuidadores</h1>
            <p className="mt-1 text-white/50">
              {patients.length === 0
                ? 'Adicione o primeiro utente abaixo'
                : `${patients.length} utente${patients.length !== 1 ? 's' : ''} acompanhado${patients.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/60 transition-colors hover:border-white/40 hover:text-white"
          >
            ← O meu perfil
          </Link>
        </div>

        {/* Summary cards */}
        {patients.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="bg-brand-signature/20 rounded-full p-2.5">
                  <Users className="text-brand-lilac h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-white/50">Utentes</p>
                  <p className="text-2xl font-bold text-white">{patients.length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-full p-2.5 ${totalAlerts > 0 ? 'bg-red-500/20' : 'bg-white/10'}`}
                >
                  <AlertTriangle
                    className={`h-5 w-5 ${totalAlerts > 0 ? 'text-red-400' : 'text-white/40'}`}
                  />
                </div>
                <div>
                  <p className="text-sm text-white/50">Alertas não lidos</p>
                  <p
                    className={`text-2xl font-bold ${totalAlerts > 0 ? 'text-red-400' : 'text-white'}`}
                  >
                    {totalAlerts}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Patient list */}
        {patients.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium tracking-wider text-white/40 uppercase">Utentes</h2>
            {patients.map((p) => (
              <Link key={p.id} href={`/cuidador/${p.id}`}>
                <div className="hover:border-brand-lilac/30 group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-all hover:bg-white/8 active:scale-[0.98]">
                  {/* Avatar */}
                  <div className="bg-brand-signature/20 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                    <span className="text-brand-lilac text-lg font-bold">
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{p.name}</span>
                      {Number(p.unread_alerts) > 0 && (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                          {p.unread_alerts} alerta{Number(p.unread_alerts) !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/50">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDaysAgo(p.last_session)}
                      </span>
                      <span>{p.total_sessions} conversa{Number(p.total_sessions) !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Emotion + chevron */}
                  <div className="flex shrink-0 items-center gap-2">
                    {p.last_emotional_state && (
                      <span
                        className={`hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline-block ${emotionClass(p.last_emotional_state)}`}
                      >
                        {p.last_emotional_state}
                      </span>
                    )}
                    <ChevronRight className="h-5 w-5 text-white/30 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Add patient */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div className="mb-4 flex items-center gap-3">
            <div className="bg-brand-signature/20 rounded-full p-2">
              <Users className="text-brand-lilac h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Adicionar Utente</h2>
              <p className="text-sm text-white/50">
                Introduza o código de 6 letras que o utente pode ver no seu perfil
              </p>
            </div>
          </div>
          <LinkPatientForm />
        </div>
      </div>
    </div>
  );
}
