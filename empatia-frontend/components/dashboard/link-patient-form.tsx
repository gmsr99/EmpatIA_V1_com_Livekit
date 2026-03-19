'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';

export function LinkPatientForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/cuidador/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: code.trim().toUpperCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao adicionar utente');
      } else {
        setSuccess(`${data.patient.name} adicionado com sucesso!`);
        setCode('');
        router.refresh();
      }
    } catch {
      setError('Erro de ligação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Ex: ABC123"
          maxLength={6}
          className="font-mono h-11 flex-1 rounded-xl border border-white/20 bg-black/30 px-4 text-center text-lg font-bold tracking-widest text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
          required
        />
        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="bg-brand-signature hover:bg-brand-signature/80 disabled:bg-brand-signature/30 flex h-11 min-w-[44px] items-center justify-center rounded-xl px-4 font-semibold text-white transition-all disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <UserPlus className="h-5 w-5" />
          )}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-brand-lilac text-sm">{success}</p>}
    </form>
  );
}
