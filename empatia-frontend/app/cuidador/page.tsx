import { AlertTriangle, Clock, Users } from 'lucide-react';
import Link from 'next/link';
import { auth } from '@/auth';
import pool from '@/lib/db';
import { SignOutButton } from '@/components/cuidador/sign-out-button';
import { SubscriptionBanner } from '@/components/cuidador/subscription-banner';
import { CreatePatientButton } from '@/components/cuidador/create-patient-button';

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
  // Layout handles the unauthenticated UI, but the page still executes in Next.js 15 — guard here too
  if (!session?.user?.id) return null;

  const client = await pool.connect();

  let patients: Array<{
    id: string;
    name: string;
    last_session: Date | null;
    last_emotional_state: string | null;
    unread_alerts: number;
    total_sessions: number;
    monthly_minutes: number;
  }> = [];

  let subscription = {
    tier: 'trial',
    status: 'active',
    trial_ends_at: null as Date | null,
    patient_limit: 1,
  };

  try {
    // Load patients (owned via caregiver_id FK)
    const patientsRes = await client.query(
      `SELECT
         u.id,
         u.name,
         MAX(ss.created_at)                                           AS last_session,
         (SELECT emotional_state FROM session_summaries
          WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1)     AS last_emotional_state,
         COUNT(DISTINCT ha.id) FILTER (WHERE NOT ha.is_read)         AS unread_alerts,
         COUNT(DISTINCT ss.id)                                        AS total_sessions,
         COALESCE(
           (SELECT minutes_used FROM patient_usage
            WHERE patient_id = u.id
              AND year_month = TO_CHAR(NOW(), 'YYYY-MM')),
           0
         )                                                            AS monthly_minutes
       FROM users u
       LEFT JOIN session_summaries ss ON ss.user_id = u.id
       LEFT JOIN health_alerts ha     ON ha.user_id = u.id
       WHERE u.caregiver_id = $1
       GROUP BY u.id, u.name
       ORDER BY last_session DESC NULLS LAST`,
      [session.user!.id]
    );
    patients = patientsRes.rows;

    // Load subscription info
    const subRes = await client.query(
      `SELECT subscription_tier, subscription_status, trial_ends_at, patient_limit
       FROM caregiver_profiles WHERE user_id = $1`,
      [session.user!.id]
    );
    if (subRes.rows[0]) {
      subscription = {
        tier: subRes.rows[0].subscription_tier ?? 'trial',
        status: subRes.rows[0].subscription_status ?? 'active',
        trial_ends_at: subRes.rows[0].trial_ends_at,
        patient_limit: Number(subRes.rows[0].patient_limit ?? 1),
      };
    }
  } catch (e) {
    console.error('Cuidador page error:', e);
  } finally {
    client.release();
  }

  const totalAlerts = patients.reduce((sum, p) => sum + Number(p.unread_alerts), 0);
  const canAddPatient = patients.length < subscription.patient_limit;

  return (
    <div className="min-h-screen px-4 pb-16 pt-24 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Painel de Cuidadores</h1>
            <p className="mt-1 text-white/50">
              {patients.length === 0
                ? 'Crie o primeiro utente abaixo'
                : `${patients.length} utente${patients.length !== 1 ? 's' : ''} acompanhado${patients.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <SignOutButton />
        </div>

        {/* Subscription banner */}
        <SubscriptionBanner
          tier={subscription.tier}
          status={subscription.status}
          trialEndsAt={subscription.trial_ends_at}
          patientLimit={subscription.patient_limit}
          patientCount={patients.length}
        />

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
                  <p className="text-2xl font-bold text-white">
                    {patients.length}
                    <span className="ml-1 text-base font-normal text-white/30">
                      / {subscription.patient_limit}
                    </span>
                  </p>
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
                  <div className="bg-brand-signature/20 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                    <span className="text-brand-lilac text-lg font-bold">
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
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
                    {Number(p.monthly_minutes) > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full ${
                              Number(p.monthly_minutes) >= 1800
                                ? 'bg-red-500'
                                : Number(p.monthly_minutes) >= 1260
                                  ? 'bg-amber-400'
                                  : 'bg-white/30'
                            }`}
                            style={{
                              width: `${Math.min((Number(p.monthly_minutes) / 1800) * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="shrink-0 text-xs text-white/30">
                          {Math.floor(Number(p.monthly_minutes) / 60)}h{Number(p.monthly_minutes) % 60 > 0 ? `${Number(p.monthly_minutes) % 60}m` : ''}/30h
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {p.last_emotional_state && (
                      <span
                        className={`hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline-block ${emotionClass(p.last_emotional_state)}`}
                      >
                        {p.last_emotional_state}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Add patient */}
        <CreatePatientButton canAdd={canAddPatient} patientLimit={subscription.patient_limit} />
      </div>
    </div>
  );
}
