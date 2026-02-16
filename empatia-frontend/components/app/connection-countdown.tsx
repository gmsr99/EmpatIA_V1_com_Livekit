'use client';

import { useEffect, useRef, useState } from 'react';

interface ConnectionCountdownProps {
  onComplete: () => void;
}

export function ConnectionCountdown({ onComplete }: ConnectionCountdownProps) {
  const [count, setCount] = useState(3);
  const onCompleteRef = useRef(onComplete);

  // Manter referência atualizada do callback sem triggerar re-runs do effect
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Garantir exatamente 3 segundos: agendar todos os timers de uma vez
    // Este effect só corre UMA VEZ no mount ([] dependency)
    const timer1 = setTimeout(() => setCount(2), 1000); // 3 → 2 após 1s
    const timer2 = setTimeout(() => setCount(1), 2000); // 2 → 1 após 2s
    const completeTimer = setTimeout(() => {
      setCount(0);
      onCompleteRef.current(); // Usar ref em vez de onComplete direto
    }, 3000); // Completar após exatamente 3s

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(completeTimer);
    };
  }, []); // 🔥 Dependência vazia = só executa no mount

  if (count === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* Número do countdown */}
      <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-brand-lilac/30 bg-brand-lilac/10">
        <span className="text-5xl font-bold text-white animate-pulse">{count}</span>
      </div>

      {/* Mensagem */}
      <p className="text-center text-lg font-medium text-white/90">
        A EmpatIA vai falar em instantes...
      </p>
      <p className="mt-2 text-center text-sm text-white/60">
        Aguarde, por favor
      </p>
    </div>
  );
}
