'use client';

import { useState } from 'react';
import { Lock, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { CreatePatientModal } from './create-patient-modal';

interface Props {
  canAdd: boolean;
  patientLimit: number;
}

export function CreatePatientButton({ canAdd, patientLimit }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-3">
          <div className="bg-brand-signature/20 rounded-full p-2">
            <UserPlus className="text-brand-lilac h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Adicionar Utente</h2>
            <p className="text-sm text-white/50">
              Crie uma conta para o utente entrar na EmpatIA
            </p>
          </div>
        </div>

        {canAdd ? (
          <button
            onClick={() => setOpen(true)}
            className="bg-brand-signature hover:bg-brand-signature/80 flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all active:scale-95"
          >
            <UserPlus className="h-4 w-4" />
            Criar Utente
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/50">
              <Lock className="h-4 w-4 shrink-0" />
              Limite de {patientLimit} utente{patientLimit !== 1 ? 's' : ''} atingido no plano atual.
            </div>
            <Link
              href="/cuidador/upgrade"
              className="bg-brand-signature hover:bg-brand-signature/80 flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all active:scale-95"
            >
              Fazer upgrade para adicionar mais
            </Link>
          </div>
        )}
      </div>

      {open && <CreatePatientModal onClose={() => setOpen(false)} />}
    </>
  );
}
