'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ConnectionState, RemoteParticipant, Track } from 'livekit-client';
import { AlertCircle, Loader2, MessageCircle, Mic, MicOff, X } from 'lucide-react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { Button } from '@/components/livekit/button';
import { GlowingRingVisualizer } from './glowing-ring-visualizer';

export function HomepageVoiceAgent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [connectionDetails, setConnectionDetails] = useState<{
    serverUrl: string;
    roomName: string;
    participantToken: string;
    participantName: string;
  } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    setIsConnecting(true);
    setError(null);
    try {
      const response = await fetch('/api/connection-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identity: session?.user?.id,
          name: session?.user?.name,
        }),
      });
      console.log('DEBUG: Sending identity to API:', session?.user?.id);
      if (!response.ok) {
        throw new Error('Failed to load connection details');
      }
      const data = await response.json();
      setConnectionDetails(data);
    } catch (e) {
      console.error(e);
      setError('Failed to connect. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }, [session, status, router]);

  const disconnect = useCallback(() => {
    setConnectionDetails(null);
  }, []);

  const handleMediaDeviceFailure = useCallback((failure?: unknown) => {
    console.error('Media Device Failure Detail:', {
      failure,
      isSecureContext: window.isSecureContext,
      userAgent: navigator.userAgent,
    });

    if (!window.isSecureContext) {
      setError(
        'Erro de Segurança: O microfone só funciona em "localhost" ou "https". Verifique o URL.'
      );
      return;
    }

    // Detailed advice for MacOS/Chrome/Safari
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (isMac) {
      setError(
        'Erro no Microfone: Verifique se o browser tem permissão em "Definições do Sistema > Segurança e Privacidade > Microfone".'
      );
    } else {
      setError('Erro ao aceder ao microfone. Por favor verifique as permissões do browser.');
    }
  }, []);

  if (status === 'loading') {
    return <div className="text-white">A carregar...</div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center gap-4 text-white">
        <p>Precisa de entrar para falar com a EmpatIA.</p>
        <Button onClick={() => router.push('/login')}>Entrar na Conta</Button>
      </div>
    );
  }

  // Common container classes for consistent look
  const containerClasses =
    'relative flex h-[400px] w-full max-w-md flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl backdrop-blur-xl';

  if (connectionDetails) {
    return (
      <LiveKitRoom
        token={connectionDetails.participantToken}
        serverUrl={connectionDetails.serverUrl}
        connect={true}
        audio={true}
        video={false}
        onDisconnected={disconnect}
        onMediaDeviceFailure={handleMediaDeviceFailure}
        className={containerClasses}
      >
        <RoomAudioRenderer />
        <AgentVisualizer onDisconnect={disconnect} />
        {error && (
          <div className="absolute top-4 right-4 left-4 z-50 flex flex-col gap-2 rounded-lg border border-red-500/50 bg-red-900/90 p-3 text-sm text-red-100 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                disconnect();
                setTimeout(connect, 100);
              }}
              className="mt-1 h-8 bg-white/10 text-xs text-white hover:bg-white/20"
            >
              Tentar Novamente
            </Button>
          </div>
        )}
      </LiveKitRoom>
    );
  }

  return (
    <div className={containerClasses}>
      {/* Content Vertical Stack */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-4 py-6">
        {/* 1. Text Header */}
        <div className="space-y-1 text-center">
          <div className="text-brand-lilac text-xs font-medium tracking-widest uppercase">
            Olá, {session?.user?.name?.split(' ')[0]}
          </div>
          <h3 className="font-heading text-xl text-white/90">Posso ajudar?</h3>
        </div>

        {/* 2. Visualizer (Rings) */}
        <div className="flex items-center justify-center">
          <GlowingRingVisualizer height="180px" width="180px" />
        </div>

        {/* 3. Button */}
        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={connect}
            disabled={isConnecting}
            className="group text-brand-signature relative inline-flex h-11 items-center gap-2.5 overflow-hidden rounded-full bg-white px-6 text-sm font-semibold shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all hover:scale-105 hover:bg-white/90 disabled:opacity-70"
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4 transition-transform group-hover:rotate-12" />
            )}
            <span>{isConnecting ? 'A Ligação...' : 'Conversar Agora'}</span>
          </Button>

          {error && (
            <p className="max-w-[250px] animate-pulse text-center text-xs text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentVisualizer({ onDisconnect }: { onDisconnect: () => void }) {
  const connectionState = useConnectionState();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();

  // We want to visualize the AGENT's audio, which is a Remote Audio Track.
  const remoteTracks = useTracks([Track.Source.Microphone]).filter(
    (t) => t.participant instanceof RemoteParticipant
  );

  const agentTrackRef = remoteTracks[0];
  const [stream, setStream] = useState<MediaStream | undefined>(undefined);

  useEffect(() => {
    if (agentTrackRef?.publication?.track?.mediaStream) {
      setStream(agentTrackRef.publication.track.mediaStream);
    }
  }, [agentTrackRef]);

  const toggleMic = useCallback(async () => {
    if (localParticipant) {
      const current = localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(!current);
    }
  }, [localParticipant]);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-8">
      {/* Connection Status Label */}
      <div className="text-brand-lilac absolute top-6 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium tracking-wider uppercase backdrop-blur-md">
        {connectionState === ConnectionState.Connected ? 'Em chamada' : 'A conectar...'}
      </div>

      <div className="relative flex w-full flex-1 items-center justify-center">
        {connectionState === ConnectionState.Connected ? (
          <GlowingRingVisualizer stream={stream} height="300px" width="300px" />
        ) : (
          <div className="bg-brand-signature/20 h-32 w-32 animate-pulse rounded-full blur-xl" />
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-6 flex items-center gap-4">
        {/* Mic Toggle Indicator */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMic}
          className={`h-12 w-12 rounded-full border backdrop-blur-md transition-all ${
            isMicrophoneEnabled
              ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
              : 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20'
          }`}
        >
          {isMicrophoneEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </Button>

        <Button
          variant="destructive"
          size="icon"
          className="h-12 w-12 rounded-full border border-red-500/50 bg-red-500/20 text-red-400 backdrop-blur-md hover:bg-red-500/30"
          onClick={onDisconnect}
        >
          <X className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
