'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';

export interface CaregiverProfile {
  full_name?: string;
  gender?: string;
  age?: number | string;
  location?: string;
  profession_retired?: string;
  medications?: string;
  interests?: string;
  family?: string;
  religious?: string;
  notes?: string;
}

interface Props {
  patientId: string;
  initialProfile: CaregiverProfile;
}

export function PatientProfileForm({ patientId, initialProfile }: Props) {
  const [form, setForm] = useState<CaregiverProfile>({
    full_name: initialProfile.full_name ?? '',
    gender: initialProfile.gender ?? '',
    age: initialProfile.age ?? '',
    location: initialProfile.location ?? '',
    profession_retired: initialProfile.profession_retired ?? '',
    medications: Array.isArray(initialProfile.medications)
      ? (initialProfile.medications as unknown as string[]).join('\n')
      : (initialProfile.medications ?? ''),
    interests: Array.isArray(initialProfile.interests)
      ? (initialProfile.interests as unknown as string[]).join('\n')
      : (initialProfile.interests ?? ''),
    family: Array.isArray(initialProfile.family)
      ? (initialProfile.family as unknown as string[]).join('\n')
      : (initialProfile.family ?? ''),
    religious: initialProfile.religious ?? '',
    notes: initialProfile.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function set(field: keyof CaregiverProfile, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/cuidador/patient-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, profile: form }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Erro ao guardar');
      } else {
        setSaved(true);
      }
    } catch {
      setError('Erro de ligação. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Row 1: name + gender */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" hint="Como prefere ser chamado/a">
          <input
            type="text"
            value={form.full_name as string}
            onChange={(e) => set('full_name', e.target.value)}
            placeholder="Ex: Maria da Silva"
            className={inputClass}
          />
        </Field>
        <Field label="Género">
          <div className="grid grid-cols-2 gap-2">
            {['masculino', 'feminino'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => set('gender', form.gender === g ? '' : g)}
                className={`h-11 rounded-xl border text-sm font-medium capitalize transition-all ${
                  form.gender === g
                    ? 'border-brand-lilac/60 bg-brand-signature/20 text-white'
                    : 'border-white/15 text-white/50 hover:border-white/30 hover:text-white'
                }`}
              >
                {g === 'masculino' ? 'Masculino' : 'Feminino'}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {/* Row 1b: age */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Idade">
          <input
            type="number"
            min={0}
            max={120}
            value={form.age as string}
            onChange={(e) => set('age', e.target.value)}
            placeholder="Ex: 78"
            className={inputClass}
          />
        </Field>
      </div>

      {/* Row 2: location + profession */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Localidade / Zona" hint="Cidade, bairro ou região">
          <input
            type="text"
            value={form.location as string}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Ex: Lisboa, Benfica"
            className={inputClass}
          />
        </Field>
        <Field label="Profissão antes da reforma">
          <input
            type="text"
            value={form.profession_retired as string}
            onChange={(e) => set('profession_retired', e.target.value)}
            placeholder="Ex: Professora primária"
            className={inputClass}
          />
        </Field>
      </div>

      {/* Medications */}
      <Field label="Medicamentos" hint="Um por linha — nome e horário se possível">
        <textarea
          rows={3}
          value={form.medications as string}
          onChange={(e) => set('medications', e.target.value)}
          placeholder={`Ex:\nMetformina 500mg — manhã\nRamipril 5mg — noite`}
          className={textareaClass}
        />
      </Field>

      {/* Interests */}
      <Field label="Gostos e interesses" hint="Um por linha">
        <textarea
          rows={3}
          value={form.interests as string}
          onChange={(e) => set('interests', e.target.value)}
          placeholder={`Ex:\nJardinagem\nNovelas da tarde\nRezar o terço`}
          className={textareaClass}
        />
      </Field>

      {/* Family */}
      <Field label="Família próxima" hint="Membros importantes — um por linha">
        <textarea
          rows={3}
          value={form.family as string}
          onChange={(e) => set('family', e.target.value)}
          placeholder={`Ex:\nFilha Ana, mora no Porto\nNeto Miguel, 8 anos`}
          className={textareaClass}
        />
      </Field>

      {/* Religious */}
      <Field label="Preferências religiosas / espirituais">
        <input
          type="text"
          value={form.religious as string}
          onChange={(e) => set('religious', e.target.value)}
          placeholder="Ex: Católica praticante, gosta de rezar o terço"
          className={inputClass}
        />
      </Field>

      {/* Notes */}
      <Field
        label="Notas adicionais para a EmpatIA"
        hint="Tópicos sensíveis, preferências de conversa, contexto importante"
      >
        <textarea
          rows={3}
          value={form.notes as string}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Ex: Perdeu o marido há 2 anos. Gosta muito de falar sobre os netos. Evitar tópicos de saúde de forma alarmista."
          className={textareaClass}
        />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-signature hover:bg-brand-signature/80 disabled:bg-brand-signature/30 flex h-11 items-center gap-2 rounded-xl px-6 font-semibold text-white transition-all disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4" />
          {saving ? 'A guardar...' : 'Guardar Perfil'}
        </button>
        {saved && <span className="text-sm text-emerald-400">Guardado com sucesso ✓</span>}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-white/80">{label}</label>
      {hint && <p className="text-xs text-white/40">{hint}</p>}
      {children}
    </div>
  );
}

const inputClass =
  'h-11 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-sm text-white placeholder-white/25 focus:border-white/30 focus:outline-none';

const textareaClass =
  'w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/25 focus:border-white/30 focus:outline-none resize-none';
