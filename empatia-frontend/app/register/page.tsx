'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Check, Loader2 } from 'lucide-react';

type Plan = 'basic' | 'extended' | 'professional';

const PLANS: Array<{
  id: Plan;
  name: string;
  price: string;
  patients: number;
  trial: string | null;
  features: string[];
  highlight?: boolean;
}> = [
  {
    id: 'basic',
    name: 'Básico',
    price: '35',
    patients: 1,
    trial: '15 dias grátis',
    features: ['1 utente', 'Conversas ilimitadas', 'Dashboard completo', 'Alertas de saúde'],
  },
  {
    id: 'extended',
    name: 'Extendido',
    price: '60',
    patients: 2,
    trial: null,
    highlight: true,
    features: ['2 utentes', 'Conversas ilimitadas', 'Dashboard completo', 'Alertas de saúde'],
  },
  {
    id: 'professional',
    name: 'Profissional',
    price: '140',
    patients: 5,
    trial: null,
    features: [
      '5 utentes',
      'Conversas ilimitadas',
      'Dashboard completo',
      'Alertas de saúde',
      'Para instituições',
    ],
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>('basic');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedPlan = PLANS.find((p) => p.id === plan)!;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Create account
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, user_type: 'caregiver', plan }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(
          data.message === 'Email already exists'
            ? 'Este email já está registado.'
            : data.message || 'Erro ao criar conta.'
        );
        setLoading(false);
        return;
      }

      // 2. Sign in
      const signInRes = await signIn('credentials', { email, password, redirect: false });
      if (signInRes?.error) {
        setError('Conta criada, mas erro ao entrar. Faça login manualmente.');
        setLoading(false);
        router.push('/cuidador');
        return;
      }

      // 3. Redirect
      if (plan === 'basic') {
        // Basic: 15-day trial, go to dashboard
        router.push('/cuidador');
      } else {
        // Extendido/Profissional: go to checkout
        const checkoutRes = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        });
        const checkoutData = await checkoutRes.json();
        if (checkoutRes.ok && checkoutData.url) {
          window.location.href = checkoutData.url;
        } else {
          // Stripe not configured yet — redirect to upgrade page
          router.push('/cuidador/upgrade');
        }
      }
    } catch {
      setError('Erro de ligação. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black px-4 py-12 text-white">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-heading text-4xl font-bold text-white">Criar Conta de Cuidador</h1>
          <p className="mt-2 text-white/50">Escolha o plano e comece hoje.</p>
        </div>

        {/* Plan selector */}
        <div className="grid gap-3 sm:grid-cols-3">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlan(p.id)}
              className={`relative flex flex-col rounded-2xl border p-5 text-left transition-all ${
                plan === p.id
                  ? 'border-brand-lilac/60 bg-brand-signature/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              {p.highlight && (
                <span className="bg-brand-signature absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white">
                  Popular
                </span>
              )}

              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wider text-white/50">
                    {p.name}
                  </p>
                  <p className="mt-0.5">
                    <span className="text-2xl font-bold text-white">€{p.price}</span>
                    <span className="text-white/40">/mês</span>
                  </p>
                </div>
                <div
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    plan === p.id ? 'border-brand-lilac bg-brand-signature/30' : 'border-white/20'
                  }`}
                >
                  {plan === p.id && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
              </div>

              {p.trial && (
                <span className="mb-3 inline-block rounded-lg bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                  {p.trial}
                </span>
              )}

              <ul className="space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                    <Check className="text-brand-lilac h-3.5 w-3.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
          {error && (
            <div className="mb-5 rounded-xl bg-red-500/20 p-3 text-center text-sm text-red-300">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                Nome
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="O seu nome completo"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
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
              <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                Palavra-passe
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-brand-signature hover:bg-brand-signature/80 mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading
                ? 'A criar conta...'
                : plan === 'basic'
                  ? 'Começar Trial Grátis'
                  : `Subscrever Plano ${selectedPlan.name}`}
            </button>

            {plan === 'basic' && (
              <p className="text-center text-xs text-white/30">
                15 dias grátis. Cancele a qualquer momento.
              </p>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-white/40">
          Já tem conta?{' '}
          <Link href="/cuidador" className="text-white/80 underline-offset-2 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

const inputClass =
  'h-11 w-full rounded-xl border border-white/15 bg-black/40 px-4 text-sm text-white placeholder-white/25 focus:border-white/40 focus:outline-none';
