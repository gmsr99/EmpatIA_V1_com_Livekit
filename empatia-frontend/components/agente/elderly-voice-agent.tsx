'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectionState, RemoteParticipant, Track } from 'livekit-client';
import { Loader2, Mic, MicOff, PhoneOff } from 'lucide-react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { GlowingRingVisualizer } from '@/components/app/glowing-ring-visualizer';

interface Props {
  userName: string;
  userId: string;
  initialBlockedReason?: string | null;
  minutesUsed?: number;
}

const MONTHLY_LIMIT = 1800;

export function ElderlyVoiceAgent({
  userName,
  userId,
  initialBlockedReason,
  minutesUsed = 0,
}: Props) {
  const [connectionDetails, setConnectionDetails] = useState<{
    serverUrl: string;
    roomName: string;
    participantToken: string;
    participantName: string;
  } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(
    initialBlockedReason ?? null
  );

  const connectedAtRef = useRef<number | null>(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/connection-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: userId, name: userName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (
          ['TRIAL_EXPIRED', 'USAGE_LIMIT_REACHED', 'SUBSCRIPTION_INACTIVE'].includes(data.error)
        ) {
          setBlockedReason(data.error);
          return;
        }
        throw new Error('Falha ao conectar');
      }
      connectedAtRef.current = Date.now();
      setConnectionDetails(await res.json());
    } catch {
      setError('Não foi possível conectar. Verifique a sua ligação à internet e tente novamente.');
    } finally {
      setIsConnecting(false);
    }
  }, [userId, userName]);

  const disconnect = useCallback(() => {
    if (connectedAtRef.current) {
      const minutes = Math.ceil((Date.now() - connectedAtRef.current) / 60_000);
      if (minutes > 0) {
        fetch('/api/usage/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ minutes }),
        }).catch(() => {});
      }
      connectedAtRef.current = null;
    }
    setConnectionDetails(null);
  }, []);

  // Blocked screens
  if (blockedReason === 'TRIAL_EXPIRED') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-8 text-center">
        <div className="space-y-4">
          <p className="text-6xl">⏰</p>
          <p className="font-heading text-3xl font-bold text-white sm:text-4xl">
            Período de Teste Terminado
          </p>
          <p className="text-xl text-white/60 sm:text-2xl">
            Os 15 dias de prova terminaram.
          </p>
          <p className="text-lg text-white/40">
            Fale com o seu cuidador para continuar a usar a EmpatIA.
          </p>
        </div>
      </div>
    );
  }

  if (blockedReason === 'USAGE_LIMIT_REACHED') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-8 text-center">
        <div className="space-y-4">
          <p className="text-6xl">🕐</p>
          <p className="font-heading text-3xl font-bold text-white sm:text-4xl">
            Limite Mensal Atingido
          </p>
          <p className="text-xl text-white/60 sm:text-2xl">
            Já utilizou as 30 horas deste mês.
          </p>
          <p className="text-lg text-white/40">
            O limite renova-se no início do próximo mês.
          </p>
        </div>
      </div>
    );
  }

  if (blockedReason === 'SUBSCRIPTION_INACTIVE') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-8 text-center">
        <div className="space-y-4">
          <p className="text-6xl">🔒</p>
          <p className="font-heading text-3xl font-bold text-white sm:text-4xl">
            Serviço Indisponível
          </p>
          <p className="text-xl text-white/60 sm:text-2xl">
            A subscrição não está ativa.
          </p>
          <p className="text-lg text-white/40">
            Peça ao seu cuidador para verificar o plano.
          </p>
        </div>
      </div>
    );
  }

  if (connectionDetails) {
    return (
      <LiveKitRoom
        token={connectionDetails.participantToken}
        serverUrl={connectionDetails.serverUrl}
        connect={true}
        audio={true}
        video={false}
        onDisconnected={disconnect}
        className="min-h-screen bg-black"
      >
        <RoomAudioRenderer />
        <ElderlyCallView onDisconnect={disconnect} userName={userName} />
      </LiveKitRoom>
    );
  }

  const usagePercent = Math.min((minutesUsed / MONTHLY_LIMIT) * 100, 100);
  const hoursUsed = Math.floor(minutesUsed / 60);
  const minsUsed = minutesUsed % 60;
  const showUsage = minutesUsed > 0;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-black px-6">
      {/* Greeting */}
      <div className="text-center">
        <p className="text-2xl text-white/50 sm:text-3xl">Olá,</p>
        <h1 className="font-heading text-5xl font-bold text-white sm:text-6xl">{userName}</h1>
      </div>

      {/* Idle visualizer */}
      <GlowingRingVisualizer height="220px" width="220px" />

      {/* Big connect button */}
      <button
        onClick={connect}
        disabled={isConnecting}
        className="flex h-24 w-80 items-center justify-center gap-4 rounded-full bg-white text-2xl font-bold text-black shadow-2xl transition-all hover:scale-105 hover:bg-white/90 active:scale-95 disabled:opacity-60 sm:h-28 sm:w-96 sm:text-3xl"
        aria-label="Começar a falar com a EmpatIA"
      >
        {isConnecting ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>A ligar...</span>
          </>
        ) : (
          <>
            <span className="text-4xl">🎙</span>
            <span>Falar</span>
          </>
        )}
      </button>

      {error && (
        <div className="max-w-sm rounded-2xl bg-red-500/20 p-5 text-center text-lg text-red-300">
          {error}
          <button
            onClick={connect}
            className="mt-4 block w-full rounded-xl bg-white/10 py-3 text-white hover:bg-white/20"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Monthly usage bar — only show if some usage recorded */}
      {showUsage && (
        <div className="w-full max-w-xs space-y-2">
          <div className="flex justify-between text-sm text-white/30">
            <span>
              {hoursUsed > 0 ? `${hoursUsed}h ${minsUsed}m` : `${minsUsed}m`} usados este mês
            </span>
            <span>30h</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${
                usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-400' : 'bg-white/40'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ElderlyCallView({
  onDisconnect,
  userName,
}: {
  onDisconnect: () => void;
  userName: string;
}) {
  const connectionState = useConnectionState();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const remoteTracks = useTracks([Track.Source.Microphone]).filter(
    (t) => t.participant instanceof RemoteParticipant
  );
  const agentTrackRef = remoteTracks[0];
  const [stream, setStream] = useState<MediaStream | undefined>(undefined);

  const agentParticipant = agentTrackRef?.participant as RemoteParticipant | undefined;
  const isAgentSpeaking = agentParticipant?.isSpeaking ?? false;
  const isUserSpeaking = localParticipant?.isSpeaking ?? false;
  const isConnected = connectionState === ConnectionState.Connected;

  useEffect(() => {
    if (agentTrackRef?.publication?.track?.mediaStream) {
      setStream(agentTrackRef.publication.track.mediaStream);
    }
  }, [agentTrackRef]);

  const toggleMic = useCallback(async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
    }
  }, [localParticipant]);

  let statusLabel: string;
  let statusClass: string;
  let statusDot: string;

  if (!isConnected) {
    statusLabel = 'A ligar...';
    statusClass = 'text-white/60';
    statusDot = 'bg-white/30 animate-pulse';
  } else if (isAgentSpeaking) {
    statusLabel = 'A EmpatIA está a falar';
    statusClass = 'text-purple-300';
    statusDot = 'bg-purple-400 animate-pulse';
  } else if (isUserSpeaking) {
    statusLabel = 'A ouvir...';
    statusClass = 'text-emerald-300';
    statusDot = 'bg-emerald-400 animate-pulse';
  } else {
    statusLabel = 'A pensar...';
    statusClass = 'text-white/40';
    statusDot = 'bg-white/20 animate-pulse';
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-black px-6 py-10">
      {/* Header */}
      <div className="text-center">
        <p className="text-xl text-white/50 sm:text-2xl">Em chamada — {userName}</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className={`h-3 w-3 rounded-full ${statusDot}`} />
          <p className={`text-2xl font-semibold sm:text-3xl ${statusClass}`}>{statusLabel}</p>
        </div>
      </div>

      {/* Visualizer */}
      <div className="flex flex-1 items-center justify-center">
        <GlowingRingVisualizer
          stream={isConnected ? stream : undefined}
          height="280px"
          width="280px"
        />
      </div>

      {/* Controls */}
      <div className="flex items-end gap-12">
        {/* Mic toggle */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={toggleMic}
            className={`flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all sm:h-24 sm:w-24 ${
              isMicrophoneEnabled
                ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                : 'border-red-500/60 bg-red-500/20 text-red-400 hover:bg-red-500/30'
            }`}
            aria-label={isMicrophoneEnabled ? 'Desligar microfone' : 'Ligar microfone'}
          >
            {isMicrophoneEnabled ? (
              <Mic className="h-9 w-9 sm:h-11 sm:w-11" />
            ) : (
              <MicOff className="h-9 w-9 sm:h-11 sm:w-11" />
            )}
          </button>
          <span className="text-base text-white/60 sm:text-lg">Microfone</span>
        </div>

        {/* Hang up */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onDisconnect}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl transition-all hover:bg-red-600 active:scale-95 sm:h-28 sm:w-28"
            aria-label="Terminar chamada"
          >
            <PhoneOff className="h-10 w-10 sm:h-12 sm:w-12" />
          </button>
          <span className="text-base text-white/60 sm:text-lg">Desligar</span>
        </div>
      </div>
    </div>
  );
}
