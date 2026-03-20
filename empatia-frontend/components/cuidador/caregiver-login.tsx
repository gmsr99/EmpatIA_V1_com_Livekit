'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { HeartHandshake, Loader2 } from 'lucide-react';

export function CaregiverLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.error) {
      setError('Credenciais inválidas. Verifique o email e a palavra-passe.');
      setLoading(false);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <HeartHandshake className="text-brand-lilac h-7 w-7" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-white">Painel de Cuidadores</h1>
          <p className="mt-2 text-sm text-white/40">
            Acesso exclusivo para familiares e cuidadores
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur-md">
          {error && (
            <div className="mb-5 rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold tracking-wider text-white/50 uppercase">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="o-seu-email@exemplo.pt"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold tracking-wider text-white/50 uppercase">
                Palavra-passe
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-brand-signature hover:bg-brand-signature/80 mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'A entrar...' : 'Entrar'}
            </button>
          </form>
        </div>

        <div className="space-y-2 text-center text-sm text-white/35">
          <p>
            Não tem conta?{' '}
            <Link
              href="/register?type=caregiver"
              className="text-white/60 underline-offset-2 hover:text-white hover:underline"
            >
              Criar conta de cuidador
            </Link>
          </p>
          <p>
            É utilizador (idoso)?{' '}
            <Link
              href="/agente"
              className="text-white/60 underline-offset-2 hover:text-white hover:underline"
            >
              Aceder aqui
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white placeholder-white/20 focus:border-white/30 focus:outline-none';
