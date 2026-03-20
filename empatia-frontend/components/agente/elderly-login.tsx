'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function ElderlyLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await signIn('credentials', { username, password, redirect: false });
    if (res?.error) {
      setError('Nome de utilizador ou palavra-passe incorretos. Tente novamente.');
      setLoading(false);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-12">
      {/* Brand */}
      <div className="mb-10 text-center">
        <h1 className="font-heading text-5xl font-bold text-white sm:text-6xl">EmpatIA</h1>
        <p className="mt-3 text-xl text-white/50 sm:text-2xl">A sua companhia de confiança</p>
      </div>

      <div className="w-full max-w-sm space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md sm:max-w-md sm:p-10">
        <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">Entrar</h2>

        {error && (
          <div className="rounded-2xl bg-red-500/20 p-4 text-center text-lg text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-lg font-medium text-white/80 sm:text-xl">
              Nome de utilizador
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-14 w-full rounded-2xl border border-white/20 bg-black/50 px-5 text-lg text-white placeholder-white/30 focus:border-white/50 focus:outline-none sm:h-16 sm:text-xl"
              placeholder="o-seu-nome"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-lg font-medium text-white/80 sm:text-xl">
              Palavra-passe
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 w-full rounded-2xl border border-white/20 bg-black/50 px-5 text-lg text-white placeholder-white/30 focus:border-white/50 focus:outline-none sm:h-16 sm:text-xl"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-white text-xl font-bold text-black shadow-lg transition-all hover:bg-white/90 active:scale-95 disabled:opacity-60 sm:h-20 sm:text-2xl"
          >
            {loading && <Loader2 className="h-6 w-6 animate-spin" />}
            {loading ? 'A entrar...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-base text-white/30 sm:text-lg">
          A sua conta é criada pelo seu cuidador.
        </p>
      </div>
    </div>
  );
}
