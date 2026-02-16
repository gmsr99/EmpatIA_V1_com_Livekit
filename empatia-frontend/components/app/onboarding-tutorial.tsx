'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/livekit/button';

interface OnboardingTutorialProps {
  onComplete: () => void;
}

export function OnboardingTutorial({ onComplete }: OnboardingTutorialProps) {
  const [step, setStep] = useState(1);

  const steps = [
    {
      title: 'Bem-vindo à EmpatIA!',
      description:
        'Sou a sua companheira para conversas. Estou aqui para o ouvir e conversar consigo sempre que quiser. Vamos aprender como funciona?',
      icon: '👋',
    },
    {
      title: 'Clique em "Conversar Agora"',
      description:
        'Quando clicar no botão, o seu navegador vai pedir permissão para usar o microfone. Por favor, clique em "Permitir". Não se preocupe, é seguro!',
      icon: '🎤',
    },
    {
      title: 'Fale Naturalmente',
      description:
        'Pode falar comigo como se estivesse a conversar com uma amiga. Não precisa de gritar nem de falar muito depressa. Fale como fala normalmente!',
      icon: '💬',
    },
    {
      title: 'Estou Sempre a Ouvir',
      description:
        'Quando vir os anéis a brilhar, estou a ouvi-lo. Pode fazer pausas para pensar, não há pressa. Estou aqui para si!',
      icon: '👂',
    },
  ];

  const currentStep = steps[step - 1];

  const handleNext = () => {
    if (step === steps.length) {
      // Marcar tutorial como completo
      localStorage.setItem('empatia_tutorial_completed', 'true');
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('empatia_tutorial_completed', 'true');
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900 to-black p-8 shadow-2xl">
        {/* Botão de fechar (X) */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 opacity-50 transition-opacity hover:opacity-100"
          aria-label="Fechar tutorial"
        >
          <X className="h-5 w-5 text-white" />
        </button>

        {/* Emoji grande */}
        <div className="mb-6 text-center text-6xl">{currentStep.icon}</div>

        {/* Título */}
        <h2 className="mb-3 text-center text-2xl font-bold text-white">{currentStep.title}</h2>

        {/* Descrição */}
        <p className="mb-6 text-center leading-relaxed text-white/70">{currentStep.description}</p>

        {/* Progress dots */}
        <div className="mb-6 flex justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i + 1 === step ? 'bg-brand-lilac w-6' : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Botões de navegação */}
        <div className="flex gap-3">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              Anterior
            </Button>
          )}

          <Button
            onClick={handleNext}
            className="text-brand-signature flex-1 bg-white hover:bg-white/90"
          >
            {step === steps.length ? 'Começar!' : 'Próximo'}
          </Button>
        </div>

        {/* Link para saltar tutorial (só no último step) */}
        {step < steps.length && (
          <button
            onClick={handleSkip}
            className="mt-4 w-full text-center text-sm text-white/50 transition-colors hover:text-white/70"
          >
            Já sei, saltar tutorial
          </button>
        )}
      </div>
    </div>
  );
}
