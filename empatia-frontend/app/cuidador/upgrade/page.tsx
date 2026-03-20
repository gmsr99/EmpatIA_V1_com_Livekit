'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, Loader2 } from 'lucide-react';

const PLANS = [
  {
    id: 'basic',
    name: 'Básico',
    price: '35',
    patients: 1,
    features: ['1 utente', 'Conversas ilimitadas', 'Dashboard completo', 'Alertas de saúde'],
  },
  {
    id: 'extended',
    name: 'Extendido',
    price: '60',
    patients: 2,
    features: ['2 utentes', 'Conversas ilimitadas', 'Dashboard completo', 'Alertas de saúde'],
    highlight: true,
  },
  {
    id: 'professional',
    name: 'Profissional',
    price: '140',
    patients: 5,
    features: [
      '5 utentes',
      'Conversas ilimitadas',
      'Dashboard completo',
      'Alertas de saúde',
      'Para instituições e profissionais',
    ],
  },
];

export default function UpgradePage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function subscribe(planId: string) {
    setLoading(planId);
    setError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao iniciar checkout');
        setLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Erro de ligação. Tente novamente.');
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen px-4 pb-16 pt-24 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div>
          <Link
            href="/cuidador"
            className="mb-4 flex items-center gap-1 text-sm text-white/50 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar ao painel
          </Link>
          <h1 className="font-heading text-3xl font-bold text-white">Escolha o seu Plano</h1>
          <p className="mt-1 text-white/50">Cancele a qualquer momento. Sem compromisso.</p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/20 p-4 text-sm text-red-300">{error}</div>
        )}

        {/* Plans */}
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 backdrop-blur-md transition-all ${
                plan.highlight
                  ? 'border-brand-lilac/40 bg-brand-signature/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              {plan.highlight && (
                <div className="bg-brand-signature absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold text-white">
                  Mais popular
                </div>
              )}

              <div className="mb-4">
                <p className="text-sm font-medium uppercase tracking-wider text-white/50">
                  {plan.name}
                </p>
                <p className="mt-1">
                  <span className="text-3xl font-bold text-white">€{plan.price}</span>
                  <span className="text-white/40">/mês</span>
                </p>
              </div>

              <ul className="mb-6 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                    <Check className="text-brand-lilac mt-0.5 h-4 w-4 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => subscribe(plan.id)}
                disabled={!!loading}
                className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:opacity-60 ${
                  plan.highlight
                    ? 'bg-brand-signature hover:bg-brand-signature/80 text-white'
                    : 'border border-white/20 text-white hover:bg-white/10'
                }`}
              >
                {loading === plan.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Subscrever'
                )}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-white/30">
          Pagamento seguro via Stripe · Os preços incluem IVA
        </p>
      </div>
    </div>
  );
}
