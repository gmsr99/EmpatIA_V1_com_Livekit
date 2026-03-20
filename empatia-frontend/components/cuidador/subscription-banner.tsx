import Link from 'next/link';
import { AlertTriangle, CreditCard, Crown } from 'lucide-react';

interface Props {
  tier: string;
  status: string;
  trialEndsAt: Date | null;
  patientLimit: number;
  patientCount: number;
}

const TIER_LABELS: Record<string, string> = {
  trial: 'Trial',
  basic: 'Básico',
  extended: 'Extendido',
  professional: 'Profissional',
};

const TIER_LIMITS: Record<string, number> = {
  trial: 1,
  basic: 1,
  extended: 2,
  professional: 5,
};

export function SubscriptionBanner({ tier, status, trialEndsAt, patientLimit, patientCount }: Props) {
  const now = Date.now();
  const isTrial = tier === 'trial';
  const trialExpired = isTrial && trialEndsAt && new Date(trialEndsAt).getTime() < now;
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now) / 86_400_000))
    : null;

  const atLimit = patientCount >= patientLimit;

  // Expired trial
  if (trialExpired || status === 'canceled' || status === 'inactive') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div className="flex-1">
          <p className="font-semibold text-red-300">
            {trialExpired ? 'Trial expirado' : 'Subscrição inativa'}
          </p>
          <p className="mt-0.5 text-sm text-red-300/70">
            Escolha um plano para continuar a usar a EmpatIA.
          </p>
        </div>
        <Link
          href="/cuidador/upgrade"
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-red-500/20 px-3 py-1.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/30"
        >
          <CreditCard className="h-4 w-4" />
          Subscrever
        </Link>
      </div>
    );
  }

  // Trial active with days warning
  if (isTrial && daysLeft !== null) {
    const urgent = daysLeft <= 3;
    return (
      <div
        className={`flex items-start gap-3 rounded-2xl border p-4 ${
          urgent
            ? 'border-amber-500/30 bg-amber-500/10'
            : 'border-white/10 bg-white/5'
        }`}
      >
        <Crown className={`mt-0.5 h-5 w-5 shrink-0 ${urgent ? 'text-amber-400' : 'text-white/40'}`} />
        <div className="flex-1">
          <p className={`font-semibold ${urgent ? 'text-amber-300' : 'text-white/70'}`}>
            Trial gratuito — {daysLeft === 0 ? 'expira hoje' : `${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`}
          </p>
          <p className={`mt-0.5 text-sm ${urgent ? 'text-amber-300/70' : 'text-white/40'}`}>
            {TIER_LIMITS['trial']} utente incluído. Subscreva para desbloquear mais.
          </p>
        </div>
        <Link
          href="/cuidador/upgrade"
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
            urgent
              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
              : 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Upgrade
        </Link>
      </div>
    );
  }

  // Active paid plan — only show if at limit
  if (atLimit) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <Crown className="text-brand-lilac h-5 w-5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white/70">
            Plano {TIER_LABELS[tier] ?? tier} — limite atingido ({patientCount}/{patientLimit} utentes)
          </p>
        </div>
        <Link
          href="/cuidador/upgrade"
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/60 transition-colors hover:bg-white/15 hover:text-white"
        >
          <CreditCard className="h-4 w-4" />
          Upgrade
        </Link>
      </div>
    );
  }

  // Healthy active plan — no banner needed
  return null;
}
