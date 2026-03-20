import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  Clock,
  Heart,
  MessageCircle,
  UserCog,
  Users,
} from 'lucide-react';
import { auth } from '@/auth';
import pool from '@/lib/db';
import { PatientProfileForm } from '@/components/dashboard/patient-profile-form';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDaysAgo(date: Date | null): string {
  if (!date) return 'Nunca conversou';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `Há ${days} dias`;
  return `Há ${Math.floor(days / 7)} sem.`;
}

function classifyEmotion(state: string): 'positive' | 'neutral' | 'negative' {
  const s = (state || '').toLowerCase();
  const pos = ['feliz', 'bem', 'animado', 'contente', 'alegre', 'tranquilo', 'satisfeito', 'ótimo', 'calmo', 'positivo'];
  const neg = ['triste', 'mal', 'preocupado', 'ansioso', 'sozinho', 'dores', 'cansado', 'deprimido', 'assustado'];
  if (pos.some((w) => s.includes(w))) return 'positive';
  if (neg.some((w) => s.includes(w))) return 'negative';
  return 'neutral';
}

const emotionDotClass = {
  positive: 'bg-emerald-400',
  neutral: 'bg-slate-500',
  negative: 'bg-amber-400',
};

const emotionBadgeClass = {
  positive: 'bg-emerald-500/20 text-emerald-400',
  neutral: 'bg-white/10 text-white/60',
  negative: 'bg-amber-500/20 text-amber-400',
};

const alertBadge: Record<string, string> = {
  keyword_high: 'bg-red-500/20 text-red-400 border-red-500/30',
  keyword_medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  keyword_low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  no_contact: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  mood_decline: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const alertLabel: Record<string, string> = {
  keyword_high: '🔴 Urgente',
  keyword_medium: '🟡 Atenção',
  keyword_low: '🔵 Info',
  no_contact: '⏸ Sem contacto',
  mood_decline: '📉 Humor em declínio',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { patientId } = await params;
  const { tab = 'resumo' } = await searchParams;

  const client = await pool.connect();
  try {
    // Verify caregiver owns this patient (caregiver_id FK)
    const patientRes = await client.query(
      `SELECT u.id, u.name, u.profile,
              pp.full_name, pp.gender, pp.age, pp.location, pp.profession_retired,
              pp.medications, pp.interests, pp.family, pp.religious, pp.notes
       FROM users u
       LEFT JOIN patient_profiles pp ON pp.user_id = u.id
       WHERE u.id = $1::uuid AND u.caregiver_id = $2::uuid`,
      [patientId, session.user!.id]
    );
    if (patientRes.rows.length === 0) notFound();
    const patient = patientRes.rows[0];

    // Load all session summaries
    const sessionsRes = await client.query(
      `SELECT id, session_summary, emotional_state, created_at
       FROM session_summaries WHERE user_id = $1
       ORDER BY created_at DESC`,
      [patientId]
    );
    const sessions = sessionsRes.rows;

    // Load recent memories
    const memoriesRes = await client.query(
      `SELECT content, memory_type, created_at
       FROM user_memories WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 30`,
      [patientId]
    );
    const memories = memoriesRes.rows;

    // Load monthly usage
    const usageRes = await client.query(
      `SELECT COALESCE(minutes_used, 0) AS minutes_used
       FROM patient_usage
       WHERE patient_id = $1 AND year_month = TO_CHAR(NOW(), 'YYYY-MM')`,
      [patientId]
    );
    const monthlyMinutes = Number(usageRes.rows[0]?.minutes_used ?? 0);

    // Load keyword health alerts
    const alertsRes = await client.query(
      `SELECT id, alert_type, content, is_read, created_at
       FROM health_alerts WHERE user_id = $1
       ORDER BY created_at DESC`,
      [patientId]
    );
    const keywordAlerts = alertsRes.rows;

    // Compute stats
    const totalSessions = sessions.length;
    const lastSession = sessions[0]?.created_at ?? null;
    const daysSinceContact = lastSession
      ? Math.floor((Date.now() - new Date(lastSession).getTime()) / 86_400_000)
      : null;
    const lastEmotionalState = sessions[0]?.emotional_state ?? null;

    // Behavioral alerts (computed)
    const behavioralAlerts: Array<{ type: string; content: string }> = [];
    if (daysSinceContact !== null && daysSinceContact >= 7) {
      behavioralAlerts.push({
        type: 'no_contact',
        content: `Sem conversa há ${daysSinceContact} dias.`,
      });
    }
    const last3 = sessions.slice(0, 3).map((s) => classifyEmotion(s.emotional_state || ''));
    if (last3.length === 3 && last3.every((e) => e === 'negative')) {
      behavioralAlerts.push({
        type: 'mood_decline',
        content: 'As últimas 3 sessões tiveram estado emocional negativo.',
      });
    }

    // Last 30 days for emotion trend (one dot per session, max 20)
    const trend = sessions.slice(0, 20).reverse();

    // Weekly frequency — last 4 weeks
    const now = Date.now();
    const weekCounts = [0, 0, 0, 0];
    for (const s of sessions) {
      const age = Math.floor((now - new Date(s.created_at).getTime()) / 86_400_000);
      if (age < 7) weekCounts[3]++;
      else if (age < 14) weekCounts[2]++;
      else if (age < 21) weekCounts[1]++;
      else if (age < 28) weekCounts[0]++;
    }
    const maxWeek = Math.max(...weekCounts, 1);

    const unreadCount = keywordAlerts.filter((a) => !a.is_read).length + behavioralAlerts.length;

    return (
      <div className="min-h-screen pb-16 pt-20">
        {/* ── Sticky header ── */}
        <div className="sticky top-16 z-10 border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <Link
              href="/cuidador"
              className="flex items-center gap-1 text-sm text-white/50 transition-colors hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              Utentes
            </Link>
            <div className="flex items-center gap-3">
              <div className="bg-brand-signature/20 flex h-9 w-9 items-center justify-center rounded-full">
                <span className="text-brand-lilac font-bold">
                  {patient.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-white leading-tight">{patient.name}</p>
                <p className="text-xs text-white/40">{formatDaysAgo(lastSession)}</p>
              </div>
            </div>
            {lastEmotionalState && (
              <span
                className={`hidden rounded-full px-3 py-1 text-xs font-medium sm:inline-block ${emotionBadgeClass[classifyEmotion(lastEmotionalState)]}`}
              >
                {lastEmotionalState}
              </span>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {/* ── Tab navigation ── */}
          <div className="mt-4 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'resumo', label: 'Resumo', icon: Heart },
              { id: 'sessoes', label: 'Sessões', icon: MessageCircle },
              { id: 'memorias', label: 'Memórias', icon: BookOpen },
              { id: 'alertas', label: `Alertas${unreadCount > 0 ? ` (${unreadCount})` : ''}`, icon: AlertTriangle },
              { id: 'perfil', label: 'Perfil', icon: UserCog },
            ].map(({ id, label, icon: Icon }) => (
              <Link
                key={id}
                href={`/cuidador/${patientId}?tab=${id}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  tab === id
                    ? 'bg-brand-signature/20 text-brand-lilac'
                    : 'text-white/50 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>

          <div className="mt-6 space-y-6">
            {/* ══════════════════════════════════════════
                TAB: RESUMO
            ══════════════════════════════════════════ */}
            {tab === 'resumo' && (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Conversas', value: totalSessions },
                    { label: 'Memórias', value: memories.length },
                    { label: 'Último contacto', value: formatDaysAgo(lastSession) },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center"
                    >
                      <p className="text-xl font-bold text-white sm:text-2xl">{value}</p>
                      <p className="mt-0.5 text-xs text-white/50">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Monthly usage bar */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-white/60">Uso este mês</p>
                    <p className={`text-sm font-semibold ${monthlyMinutes >= 1800 ? 'text-red-400' : monthlyMinutes >= 1260 ? 'text-amber-400' : 'text-white/70'}`}>
                      {Math.floor(monthlyMinutes / 60)}h {monthlyMinutes % 60}m
                      <span className="ml-1 font-normal text-white/30">/ 30h</span>
                    </p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        monthlyMinutes >= 1800
                          ? 'bg-red-500'
                          : monthlyMinutes >= 1260
                            ? 'bg-amber-400'
                            : 'bg-brand-signature/70'
                      }`}
                      style={{ width: `${Math.min((monthlyMinutes / 1800) * 100, 100)}%` }}
                    />
                  </div>
                  {monthlyMinutes >= 1800 && (
                    <p className="mt-2 text-xs text-red-400">
                      Limite atingido — utente bloqueado até ao próximo mês.
                    </p>
                  )}
                  {monthlyMinutes >= 1260 && monthlyMinutes < 1800 && (
                    <p className="mt-2 text-xs text-amber-400">
                      Mais de 70% do limite mensal utilizado.
                    </p>
                  )}
                </div>

                {/* Behavioral alerts */}
                {behavioralAlerts.length > 0 && (
                  <div className="space-y-2">
                    {behavioralAlerts.map((a, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 rounded-xl border p-4 ${alertBadge[a.type]}`}
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold">{alertLabel[a.type]}</p>
                          <p className="text-sm opacity-80">{a.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Emotion trend */}
                {trend.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="mb-4 text-sm font-medium text-white/60">
                      Evolução Emocional — últimas {trend.length} sessões
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {trend.map((s, i) => {
                        const emotion = classifyEmotion(s.emotional_state || '');
                        return (
                          <div key={i} className="group relative">
                            <div
                              className={`h-4 w-4 rounded-full transition-transform group-hover:scale-125 ${emotionDotClass[emotion]}`}
                              title={s.emotional_state}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex items-center gap-4 text-xs text-white/40">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        Positivo
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-500" />
                        Neutro
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
                        Negativo
                      </span>
                    </div>
                  </div>
                )}

                {/* Weekly frequency chart */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="mb-5 text-sm font-medium text-white/60">Frequência — últimas 4 semanas</p>
                  <div className="flex items-end gap-3">
                    {weekCounts.map((count, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center gap-2">
                        <span className="text-xs font-medium text-white/70">{count}</span>
                        <div className="w-full rounded-t-lg bg-white/10" style={{ height: '60px' }}>
                          <div
                            className="bg-brand-signature/70 w-full rounded-t-lg transition-all"
                            style={{ height: `${(count / maxWeek) * 60}px` }}
                          />
                        </div>
                        <span className="text-xs text-white/40">
                          {['−4s', '−3s', '−2s', 'Esta'][i]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Last 3 sessions */}
                {sessions.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-white/60">Últimas Sessões</p>
                    {sessions.slice(0, 3).map((s, i) => (
                      <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-white/40">{formatDate(s.created_at)}</span>
                          {s.emotional_state && (
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${emotionBadgeClass[classifyEmotion(s.emotional_state)]}`}
                            >
                              {s.emotional_state}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-sm text-white/70">
                          {s.session_summary || 'Sem resumo'}
                        </p>
                      </div>
                    ))}
                    {sessions.length > 3 && (
                      <Link
                        href={`/cuidador/${patientId}?tab=sessoes`}
                        className="text-brand-lilac block text-center text-sm hover:underline"
                      >
                        Ver todas as {sessions.length} sessões →
                      </Link>
                    )}
                  </div>
                )}

                {totalSessions === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
                    <Clock className="text-brand-lilac mx-auto mb-3 h-10 w-10 opacity-50" />
                    <p className="text-white/60">Este utente ainda não iniciou conversas.</p>
                  </div>
                )}
              </>
            )}

            {/* ══════════════════════════════════════════
                TAB: SESSÕES
            ══════════════════════════════════════════ */}
            {tab === 'sessoes' && (
              <div className="space-y-3">
                {sessions.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
                    <p className="text-white/50">Sem sessões registadas.</p>
                  </div>
                ) : (
                  sessions.map((s, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white/70">
                          {formatDate(s.created_at)}
                        </span>
                        {s.emotional_state && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${emotionBadgeClass[classifyEmotion(s.emotional_state)]}`}
                          >
                            {s.emotional_state}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-white/60">
                        {s.session_summary || 'Sem resumo disponível'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════
                TAB: MEMÓRIAS
            ══════════════════════════════════════════ */}
            {tab === 'memorias' && (
              <div className="space-y-6">
                {/* Structured profile */}
                {patient.profile && Object.keys(patient.profile).length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Users className="text-brand-lilac h-5 w-5" />
                      <h3 className="font-semibold text-white">Perfil Estruturado</h3>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(patient.profile as Record<string, string[]>).map(
                        ([cat, items]) =>
                          Array.isArray(items) &&
                          items.length > 0 && (
                            <div key={cat}>
                              <p className="mb-1 text-xs font-medium tracking-wider text-white/40 uppercase">
                                {cat}
                              </p>
                              <ul className="space-y-1">
                                {items.map((item, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                                    <span className="bg-brand-lilac/40 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )
                      )}
                    </div>
                  </div>
                )}

                {/* Raw memories */}
                {memories.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-white/40">
                      Memórias Episódicas ({memories.length})
                    </p>
                    {memories.map((m, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                      >
                        <p className="text-sm text-white/70">{m.content}</p>
                        <p className="mt-1 text-xs text-white/30">{formatDate(m.created_at)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
                    <p className="text-white/50">Sem memórias registadas.</p>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════
                TAB: ALERTAS
            ══════════════════════════════════════════ */}
            {tab === 'alertas' && (
              <div className="space-y-4">
                {/* Behavioral */}
                {behavioralAlerts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium tracking-wider text-white/40 uppercase">
                      Alertas Comportamentais
                    </p>
                    {behavioralAlerts.map((a, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 rounded-xl border p-4 ${alertBadge[a.type]}`}
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold">{alertLabel[a.type]}</p>
                          <p className="text-sm opacity-80">{a.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Keyword alerts */}
                {keywordAlerts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium tracking-wider text-white/40 uppercase">
                      Alertas Detetados pela EmpatIA
                    </p>
                    {keywordAlerts.map((a) => (
                      <div
                        key={a.id}
                        className={`rounded-xl border p-4 ${alertBadge[a.alert_type]} ${a.is_read ? 'opacity-50' : ''}`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">
                            {alertLabel[a.alert_type] ?? a.alert_type}
                          </span>
                          <span className="text-xs opacity-60">{formatDate(a.created_at)}</span>
                        </div>
                        <p className="text-sm opacity-90">{a.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {keywordAlerts.length === 0 && behavioralAlerts.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
                    <Heart className="text-brand-lilac mx-auto mb-3 h-10 w-10 opacity-50" />
                    <p className="font-medium text-white/70">Sem alertas registados</p>
                    <p className="mt-1 text-sm text-white/40">Tudo parece estar bem.</p>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════
                TAB: PERFIL
            ══════════════════════════════════════════ */}
            {tab === 'perfil' && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                  <div className="mb-1 flex items-center gap-2">
                    <UserCog className="text-brand-lilac h-5 w-5" />
                    <h3 className="font-semibold text-white">Perfil do Utente</h3>
                  </div>
                  <p className="mb-6 text-sm text-white/40">
                    Estas informações são partilhadas com a EmpatIA no início de cada conversa para
                    personalizar o acompanhamento.
                  </p>
                  <PatientProfileForm
                    patientId={patientId}
                    initialProfile={{
                      full_name: patient.full_name,
                      gender: patient.gender,
                      age: patient.age,
                      location: patient.location,
                      profession_retired: patient.profession_retired,
                      medications: patient.medications,
                      interests: patient.interests,
                      family: patient.family,
                      religious: patient.religious,
                      notes: patient.notes,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } finally {
    client.release();
  }
}
