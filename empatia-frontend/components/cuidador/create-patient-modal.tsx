'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Eye, EyeOff, Loader2, UserPlus, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const inputClass =
  'h-11 w-full rounded-xl border border-white/15 bg-black/40 px-4 text-sm text-white placeholder-white/25 focus:border-white/40 focus:outline-none';

const textareaClass =
  'w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder-white/25 focus:border-white/40 focus:outline-none resize-none';

export function CreatePatientModal({ onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — account
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 — profile
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [profession, setProfession] = useState('');
  const [medications, setMedications] = useState('');
  const [interests, setInterests] = useState('');
  const [family, setFamily] = useState('');
  const [religious, setReligious] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState(false);

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setUpgrade(false);
    setLoading(true);

    try {
      const res = await fetch('/api/cuidador/create-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          username,
          password,
          profile: {
            gender: gender || null,
            age: age ? Number(age) : null,
            location: location || null,
            profession_retired: profession || null,
            medications,
            interests,
            family,
            religious: religious || null,
            notes: notes || null,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao criar utente');
        if (data.upgrade) setUpgrade(true);
        setLoading(false);
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError('Erro de ligação. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-brand-signature/20 flex h-9 w-9 items-center justify-center rounded-xl">
              <UserPlus className="text-brand-lilac h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Criar Novo Utente</h2>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className={`text-xs ${step === 1 ? 'text-white/60' : 'text-white/30'}`}>
                  1. Conta
                </span>
                <ChevronRight className="h-3 w-3 text-white/20" />
                <span className={`text-xs ${step === 2 ? 'text-white/60' : 'text-white/30'}`}>
                  2. Perfil
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-xl bg-red-500/20 p-3 text-sm text-red-300">
              {error}
              {upgrade && (
                <a
                  href="/cuidador/upgrade"
                  className="mt-2 block text-center font-semibold text-white underline-offset-2 hover:underline"
                >
                  Fazer upgrade do plano →
                </a>
              )}
            </div>
          )}

          {/* ── STEP 1: Account ── */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                  Nome completo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Maria da Silva"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                  Nome de utilizador
                </label>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  placeholder="Ex: maria.silva"
                  className={inputClass}
                />
                <p className="text-xs text-white/30">
                  O utente usa este nome para entrar na EmpatIA
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                  Palavra-passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-white/30">
                  Anote esta palavra-passe — poderá redefini-la mais tarde
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 flex-1 items-center justify-center rounded-xl border border-white/15 text-sm font-medium text-white/60 transition-colors hover:border-white/30 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-brand-signature hover:bg-brand-signature/80 flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 2: Profile ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-white/40">
                Estas informações são partilhadas com a EmpatIA para personalizar cada conversa.
                Todos os campos são opcionais.
              </p>

              {/* Gender */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                  Género
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['masculino', 'feminino'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(gender === g ? '' : g)}
                      className={`h-11 rounded-xl border text-sm font-medium capitalize transition-all ${
                        gender === g
                          ? 'border-brand-lilac/60 bg-brand-signature/20 text-white'
                          : 'border-white/15 text-white/50 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {g === 'masculino' ? 'Masculino' : 'Feminino'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age + Location */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                    Idade
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Ex: 78"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                    Localidade
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ex: Lisboa, Benfica"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Profession */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                  Profissão antes da reforma
                </label>
                <input
                  type="text"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder="Ex: Professora primária"
                  className={inputClass}
                />
              </div>

              {/* Interests */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                  Gostos e interesses
                </label>
                <textarea
                  rows={3}
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  placeholder={'Ex:\nJardinagem\nNovelas da tarde\nRezar o terço'}
                  className={textareaClass}
                />
                <p className="text-xs text-white/30">Um por linha</p>
              </div>

              {/* Family */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                  Família próxima
                </label>
                <textarea
                  rows={3}
                  value={family}
                  onChange={(e) => setFamily(e.target.value)}
                  placeholder={'Ex:\nFilha Ana, mora no Porto\nNeto Miguel, 8 anos'}
                  className={textareaClass}
                />
                <p className="text-xs text-white/30">Um membro por linha</p>
              </div>

              {/* Medications */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                  Medicamentos
                </label>
                <textarea
                  rows={2}
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  placeholder={'Ex:\nMetformina 500mg — manhã\nRamipril 5mg — noite'}
                  className={textareaClass}
                />
              </div>

              {/* Religious */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                  Preferências religiosas / espirituais
                </label>
                <input
                  type="text"
                  value={religious}
                  onChange={(e) => setReligious(e.target.value)}
                  placeholder="Ex: Católica praticante, gosta de rezar o terço"
                  className={inputClass}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium uppercase tracking-wider text-white/50">
                  Notas para a EmpatIA
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Perdeu o marido há 2 anos. Gosta de falar dos netos. Evitar tópicos de saúde de forma alarmista."
                  className={textareaClass}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-medium text-white/60 transition-colors hover:border-white/30 hover:text-white"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-brand-signature hover:bg-brand-signature/80 flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {loading ? 'A criar...' : 'Criar Utente'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
