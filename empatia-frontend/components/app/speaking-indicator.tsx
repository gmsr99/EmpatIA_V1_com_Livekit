'use client';

import { Loader2, Mic } from 'lucide-react';

interface SpeakingIndicatorProps {
  isAgentSpeaking: boolean;
  isUserSpeaking: boolean;
  isAgentThinking?: boolean;
}

export function SpeakingIndicator({
  isAgentSpeaking,
  isUserSpeaking,
  isAgentThinking = false,
}: SpeakingIndicatorProps) {
  // Prioridade: Thinking > Agent Speaking > User Speaking
  if (isAgentThinking) {
    return (
      <div className="absolute top-20 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-purple-500/50 bg-purple-500/10 px-4 py-2 backdrop-blur-md">
        <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
        <span className="text-sm font-medium text-white">A recordar...</span>
      </div>
    );
  }

  if (isAgentSpeaking) {
    return (
      <div className="absolute top-20 left-1/2 z-10 flex -translate-x-1/2 animate-pulse items-center gap-2 rounded-full border border-brand-lilac/50 bg-brand-lilac/10 px-4 py-2 backdrop-blur-md">
        <div className="h-2 w-2 animate-ping rounded-full bg-brand-lilac" />
        <span className="text-sm font-medium text-white">EmpatIA está a falar...</span>
      </div>
    );
  }

  if (isUserSpeaking) {
    return (
      <div className="absolute top-20 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-green-500/50 bg-green-500/10 px-4 py-2 backdrop-blur-md">
        <Mic className="h-4 w-4 text-green-400" />
        <span className="text-sm font-medium text-white">Estou a ouvir...</span>
      </div>
    );
  }

  return null;
}
