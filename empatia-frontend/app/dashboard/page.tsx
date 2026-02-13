import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Pool } from 'pg';
import { auth } from '@/auth';
import { Button } from '@/components/livekit/button';

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/login');
  }

  // Fetch full profile from DB
  const client = await pool.connect();
  let userProfile = null;
  try {
    const res = await client.query('SELECT * FROM users WHERE email = $1', [session.user.email]);
    if (res.rows.length > 0) {
      userProfile = res.rows[0];
    }
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
  }

  return (
    <div className="min-h-screen px-6 pt-24 pb-12">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header Section */}
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Área de Cliente</h1>
            <p className="mt-1 text-white/60">Bem-vindo de volta, {session.user.name}</p>
          </div>
          <Link href="/#voice-agent">
            <Button className="bg-brand-signature hover:bg-brand-signature/90 rounded-full text-white">
              Falar com EmpatIA
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Account Info Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <h2 className="mb-4 text-xl font-semibold text-white">Dados da Conta</h2>
            <div className="space-y-3">
              <div>
                <span className="block text-xs font-medium tracking-wider text-white/40 uppercase">
                  Nome
                </span>
                <span className="text-white/90">{session.user.name}</span>
              </div>
              <div>
                <span className="block text-xs font-medium tracking-wider text-white/40 uppercase">
                  Email
                </span>
                <span className="text-white/90">{session.user.email}</span>
              </div>
              <div>
                <span className="block text-xs font-medium tracking-wider text-white/40 uppercase">
                  ID de Utilizador
                </span>
                <span className="font-mono text-xs text-white/50">{session.user.id}</span>
              </div>
            </div>
          </div>

          {/* Memories/Profile Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <h2 className="mb-4 text-xl font-semibold text-white">Memórias da EmpatIA</h2>
            <p className="mb-4 text-sm text-white/60">
              Aqui estão as informações que a EmpatIA aprendeu sobre si para personalizar as
              conversas.
            </p>

            <div className="max-h-[300px] overflow-auto rounded-lg border border-white/5 bg-black/40 p-4 font-mono text-sm text-green-400">
              {userProfile?.profile ? (
                <pre>{JSON.stringify(userProfile.profile, null, 2)}</pre>
              ) : (
                <span className="text-white/40 italic">
                  Ainda sem memórias registadas. Fale com a EmpatIA para começar!
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
