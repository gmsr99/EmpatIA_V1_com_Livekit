import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Pool } from 'pg';
import { auth } from '@/auth';
import { Button } from '@/components/livekit/button';
import { Calendar, Clock, Heart, MessageCircle, Users } from 'lucide-react';

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

// Helper para formatar data de forma amigável
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) {
    const minutes = Math.floor(diff / (1000 * 60));
    return `Há ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  }
  if (hours < 24) {
    return `Há ${hours} hora${hours !== 1 ? 's' : ''}`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `Há ${days} dia${days !== 1 ? 's' : ''}`;
  }
  return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
}

// Helper para renderizar memórias de forma amigável
function renderMemories(profile: any) {
  if (!profile) return null;

  const sections = [];

  // Família
  if (profile.family && profile.family.length > 0) {
    sections.push({
      icon: Users,
      title: 'Família',
      items: profile.family,
    });
  }

  // Estado emocional
  if (profile.state && profile.state.length > 0) {
    sections.push({
      icon: Heart,
      title: 'Como se sente',
      items: profile.state,
    });
  }

  // Outros campos (health, hobbies, etc.)
  const otherFields = Object.keys(profile).filter(
    (key) => !['family', 'state'].includes(key)
  );

  for (const field of otherFields) {
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

  if (!session?.user?.email) {
    redirect('/login');
  }

  const client = await pool.connect();
  let userProfile = null;
  let conversationStats = { total: 0, lastConversation: null };
  let recentConversations: any[] = [];

  try {
    // Buscar perfil do utilizador
    const profileRes = await client.query('SELECT * FROM users WHERE email = $1', [
      session.user.email,
    ]);
    if (profileRes.rows.length > 0) {
      userProfile = profileRes.rows[0];
    }

    // Buscar estatísticas de conversas
    const statsRes = await client.query(
      `SELECT
        COUNT(*) as total,
        MAX(created_at) as last_conversation
       FROM session_summaries
       WHERE user_id = $1`,
      [session.user.id]
    );
    if (statsRes.rows.length > 0) {
      conversationStats.total = parseInt(statsRes.rows[0].total) || 0;
      conversationStats.lastConversation = statsRes.rows[0].last_conversation;
    }

    // Buscar últimas 5 conversas
    const conversationsRes = await client.query(
      `SELECT
        created_at,
        session_summary,
        emotional_state
       FROM session_summaries
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [session.user.id]
    );
    recentConversations = conversationsRes.rows;
  } catch (e) {
    console.error('Dashboard data fetch error:', e);
  } finally {
    client.release();
  }

  const memories = (userProfile?.profile ? renderMemories(userProfile.profile) : []) || [];
  const firstName = session.user.name?.split(' ')[0] || session.user.name;

  return (
    <div className="min-h-screen px-6 pt-24 pb-12">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header Section */}
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center">
          <div>
            <h1 className="font-heading text-4xl font-bold text-white">
              Olá, {firstName}! 👋
            </h1>
            <p className="mt-2 text-lg text-white/60">
              Bem-vindo à sua área pessoal
            </p>
          </div>
          <Link href="/#voice-agent">
            <Button className="bg-brand-signature hover:bg-brand-signature/90 h-12 rounded-full px-8 text-base font-semibold text-white shadow-lg transition-all hover:scale-105">
              💬 Falar com EmpatIA
            </Button>
          </Link>
        </div>

        {/* Stats Cards - Usando apenas cores da marca */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Total de Conversas */}
          <div className="rounded-2xl border border-brand-lilac/20 bg-gradient-to-br from-brand-signature/10 to-brand-signature/5 p-6 backdrop-blur-md">
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

          {/* Última Conversa */}
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

          {/* Membro desde */}
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
          {/* Left Column - Memories + Account Info */}
          <div className="space-y-6 lg:col-span-2">
            {/* Memories Section */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="mb-6 flex items-center gap-3">
                <div className="bg-brand-signature/20 rounded-full p-2">
                  <Heart className="text-brand-lilac h-6 w-6" />
                </div>
                <h2 className="font-heading text-2xl font-semibold text-white">
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
                          {section.items.map((item: string, itemIdx: number) => (
                            <li key={itemIdx} className="flex items-start gap-3 text-white/80">
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
                    <Button className="bg-brand-signature hover:bg-brand-signature/90 mt-6 rounded-full px-6 py-2 text-white shadow-lg transition-all hover:scale-105">
                      Iniciar Primeira Conversa
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Account Info */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <h2 className="font-heading mb-4 text-xl font-semibold text-white">
                Dados da Conta
              </h2>
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
              </div>
            </div>
          </div>

          {/* Right Column - Recent Conversations */}
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
                      className="rounded-lg border border-white/5 bg-black/20 p-4 transition-all hover:border-brand-lilac/30 hover:bg-black/30"
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
                  <p className="mt-1 text-xs text-white/40">
                    Fale com a EmpatIA para começar
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
