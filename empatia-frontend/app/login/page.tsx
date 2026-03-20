'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await signIn('credentials', { email, password, redirect: false });

    if (res?.error) {
      setError('Credenciais inválidas. Tente novamente.');
      setLoading(false);
      return;
    }

    // Redirect based on user role
    try {
      const meRes = await fetch('/api/me');
      const { userType } = await meRes.json();
      router.push(userType === 'caregiver' ? '/cuidador' : '/agente');
    } catch {
      router.push('/agente');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-12 text-white">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="font-heading text-4xl font-bold text-white">Entrar</h1>
          <p className="mt-2 text-white/50">EmpatIA</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
          {error && (
            <div className="mb-5 rounded-xl bg-red-500/20 p-3 text-center text-sm text-red-300">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white/80">Email</label>
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
              <label className="block text-sm font-medium text-white/80">Palavra-passe</label>
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
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-semibold text-black transition-all hover:bg-white/90 active:scale-95 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'A entrar...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-white/40">
          Não tem conta?{' '}
          <Link href="/register" className="text-white/80 underline-offset-2 hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}

const inputClass =
  'h-11 w-full rounded-xl border border-white/15 bg-black/40 px-4 text-sm text-white placeholder-white/25 focus:border-white/40 focus:outline-none';
