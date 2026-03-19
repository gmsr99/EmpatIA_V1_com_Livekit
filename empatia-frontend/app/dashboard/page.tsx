import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Calendar, Clock, Heart, MessageCircle, Share2, Users } from 'lucide-react';
import { auth } from '@/auth';
import { Button } from '@/components/livekit/button';
import pool from '@/lib/db';

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) {
    const minutes = Math.floor(diff / (1000 * 60));
    return `Há ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  }
  if (hours < 24) return `Há ${hours} hora${hours !== 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Há ${days} dia${days !== 1 ? 's' : ''}`;
  return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderMemories(profile: Record<string, any>) {
  if (!profile) return [];
  const sections = [];
  if (profile.family?.length > 0)
    sections.push({ icon: Users, title: 'Família', items: profile.family });
  if (profile.state?.length > 0)
    sections.push({ icon: Heart, title: 'Como se sente', items: profile.state });
  const other = Object.keys(profile).filter((k) => !['family', 'state'].includes(k));
  for (const field of other) {
    if (Array.isArray(profile[field]) && profile[field].length > 0) {
      sections.push({
        icon: MessageCircle,
        title: field.charAt(0).toUpperCase() + field.slice(1),
        items: profile[field],
      });
    }
  }
  return sections;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const client = await pool.connect();
  let userProfile = null;
  const conversationStats = { total: 0, lastConversation: null as Date | null };
  let recentConversations: Array<{
    created_at: Date;
    session_summary: string;
    emotional_state: string;
  }> = [];

  try {
    const profileRes = await client.query('SELECT * FROM users WHERE email = $1', [
      session.user.email,
    ]);
    if (profileRes.rows.length > 0) userProfile = profileRes.rows[0];

    const statsRes = await client.query(
      `SELECT COUNT(*) as total, MAX(created_at) as last_conversation
       FROM session_summaries WHERE user_id = $1`,
      [session.user.id]
    );
    if (statsRes.rows.length > 0) {
      conversationStats.total = parseInt(statsRes.rows[0].total) || 0;
      conversationStats.lastConversation = statsRes.rows[0].last_conversation;
    }

    const convRes = await client.query(
      `SELECT created_at, session_summary, emotional_state
       FROM session_summaries WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 5`,
      [session.user.id]
    );
    recentConversations = convRes.rows;
  } catch (e) {
    console.error('Dashboard data fetch error:', e);
  } finally {
    client.release();
  }

  const memories = userProfile?.profile ? renderMemories(userProfile.profile) : [];
  const firstName = session.user.name?.split(' ')[0] || session.user.name;
  const accessCode: string = userProfile?.access_code || '';

  return (
    <div className="min-h-screen px-4 pb-12 pt-24 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white sm:text-4xl">
              Olá, {firstName}! 👋
            </h1>
            <p className="mt-2 text-base text-white/60 sm:text-lg">Bem-vindo à sua área pessoal</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/cuidador">
              <Button
                variant="outline"
                className="h-11 rounded-full border-white/20 px-6 text-sm text-white/80 hover:border-white/40"
              >
                <Users className="mr-2 h-4 w-4" />
                Painel Cuidadores
              </Button>
            </Link>
            <Link href="/#voice-agent">
              <Button className="bg-brand-signature hover:bg-brand-signature/90 h-11 rounded-full px-6 text-sm font-semibold text-white shadow-lg transition-all hover:scale-105">
                💬 Falar com EmpatIA
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="border-brand-lilac/20 from-brand-signature/10 to-brand-signature/5 rounded-2xl border bg-gradient-to-br p-6 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="bg-brand-signature/20 rounded-full p-3">
                <MessageCircle className="text-brand-lilac h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-white/60">Total de Conversas</p>
                <p className="text-3xl font-bold text-white">{conversationStats.total}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="bg-brand-lilac/20 rounded-full p-3">
                <Clock className="text-brand-lilac h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-white/60">Última Conversa</p>
                <p className="text-base font-semibold text-white">
                  {conversationStats.lastConversation
                    ? formatDate(new Date(conversationStats.lastConversation))
                    : 'Ainda não conversou'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-4">
              <div className="bg-brand-signature/20 rounded-full p-3">
                <Calendar className="text-brand-lilac h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-white/60">Membro desde</p>
                <p className="text-base font-semibold text-white">
                  {userProfile?.created_at
                    ? new Date(userProfile.created_at).toLocaleDateString('pt-PT', {
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'Recentemente'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Memories */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="mb-6 flex items-center gap-3">
                <div className="bg-brand-signature/20 rounded-full p-2">
                  <Heart className="text-brand-lilac h-6 w-6" />
                </div>
                <h2 className="font-heading text-xl font-semibold text-white sm:text-2xl">
                  O que a EmpatIA sabe sobre si
                </h2>
              </div>
              {memories.length > 0 ? (
                <div className="space-y-4">
                  {memories.map((section, idx) => {
                    const Icon = section.icon;
                    return (
                      <div
                        key={idx}
                        className="border-brand-lilac/20 bg-brand-signature/5 rounded-xl border p-5"
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <Icon className="text-brand-lilac h-5 w-5" />
                          <h3 className="text-brand-lilac font-semibold">{section.title}</h3>
                        </div>
                        <ul className="space-y-2">
                          {section.items.map((item: string, i: number) => (
                            <li key={i} className="flex items-start gap-3 text-white/80">
                              <span className="bg-brand-lilac/40 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                              <span className="text-base leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/20 p-8 text-center">
                  <div className="bg-brand-signature/20 mx-auto mb-4 inline-flex rounded-full p-4">
                    <MessageCircle className="text-brand-lilac h-12 w-12" />
                  </div>
                  <p className="text-lg font-medium text-white/90">
                    Ainda não há memórias registadas
                  </p>
                  <p className="mt-2 text-sm text-white/60">
                    Comece a conversar com a EmpatIA para personalizar a experiência!
                  </p>
                  <Link href="/#voice-agent">
                    <Button className="bg-brand-signature hover:bg-brand-signature/90 mt-6 rounded-full px-6 py-2 text-white">
                      Iniciar Primeira Conversa
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Account + Access Code */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <h2 className="font-heading mb-5 text-xl font-semibold text-white">Dados da Conta</h2>
              <div className="space-y-4">
                <div>
                  <span className="block text-sm font-medium tracking-wider text-white/50 uppercase">
                    Nome
                  </span>
                  <span className="text-lg text-white/90">{session.user.name}</span>
                </div>
                <div>
                  <span className="block text-sm font-medium tracking-wider text-white/50 uppercase">
                    Email
                  </span>
                  <span className="text-lg text-white/90">{session.user.email}</span>
                </div>

                {/* Access Code */}
                {accessCode && (
                  <div className="border-brand-lilac/20 bg-brand-signature/5 mt-2 rounded-xl border p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Share2 className="text-brand-lilac h-4 w-4" />
                      <span className="text-brand-lilac text-sm font-semibold">
                        Código de Acesso para Cuidadores
                      </span>
                    </div>
                    <p className="mb-3 text-xs text-white/50">
                      Partilhe este código com um familiar ou cuidador para que possam acompanhar o
                      seu bem-estar.
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-3xl font-bold tracking-widest text-white">
                        {accessCode}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column — Recent conversations */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="mb-4 flex items-center gap-2">
                <MessageCircle className="text-brand-lilac h-5 w-5" />
                <h2 className="font-heading text-xl font-semibold text-white">
                  Conversas Recentes
                </h2>
              </div>
              {recentConversations.length > 0 ? (
                <div className="space-y-3">
                  {recentConversations.map((conv, idx) => (
                    <div
                      key={idx}
                      className="hover:border-brand-lilac/30 rounded-lg border border-white/5 bg-black/20 p-4 transition-all hover:bg-black/30"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs text-white/50">
                          {formatDate(new Date(conv.created_at))}
                        </span>
                        {conv.emotional_state && (
                          <span className="bg-brand-signature/20 text-brand-lilac rounded-full px-2.5 py-0.5 text-xs font-medium">
                            {conv.emotional_state}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-3 text-sm leading-relaxed text-white/70">
                        {conv.session_summary || 'Sem resumo disponível'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 bg-black/20 p-8 text-center">
                  <div className="bg-brand-signature/20 mx-auto mb-3 inline-flex rounded-full p-3">
                    <Clock className="text-brand-lilac h-10 w-10" />
                  </div>
                  <p className="text-sm text-white/60">Ainda sem conversas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
