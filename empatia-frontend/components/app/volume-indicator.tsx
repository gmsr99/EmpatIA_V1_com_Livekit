'use client';

import { useEffect, useState } from 'react';

interface VolumeIndicatorProps {
  stream?: MediaStream;
}

export function VolumeIndicator({ stream }: VolumeIndicatorProps) {
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    if (!stream) {
      setVolume(0);
      return;
    }

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animationId: number;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        if (!analyser) return;

        analyser.getByteFrequencyData(dataArray);

        // Average dos primeiros bins (voz humana)
        let sum = 0;
        const voiceRange = 50; // Aproximadamente 0-5kHz
        for (let i = 0; i < Math.min(voiceRange, dataArray.length); i++) {
          sum += dataArray[i];
        }
        const avg = sum / voiceRange;

        // Normalize to 0-1
        setVolume(avg / 255);

        animationId = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (error) {
      console.error('Error setting up volume indicator:', error);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (source) {
        source.disconnect();
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [stream]);

  const getVolumeStatus = () => {
    if (volume < 0.05) {
      return {
        text: 'Fale mais alto',
        color: 'text-red-400',
        barColor: 'from-red-500 to-red-400',
      };
    }
    if (volume < 0.15) {
      return {
        text: 'Um pouco mais alto',
        color: 'text-orange-400',
        barColor: 'from-orange-500 to-orange-400',
      };
    }
    if (volume < 0.5) {
      return {
        text: 'Ótimo!',
        color: 'text-green-400',
        barColor: 'from-green-500 to-green-400',
      };
    }
    return {
      text: 'Demasiado alto',
      color: 'text-orange-400',
      barColor: 'from-orange-500 to-orange-400',
    };
  };

  const { text, color, barColor } = getVolumeStatus();

  // Não mostrar se não há stream ou volume é 0
  if (!stream || volume < 0.01) {
    return null;
  }

  return (
    <div className="absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-md">
      {/* Barra de volume */}
      <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full bg-gradient-to-r transition-all duration-100 ${barColor}`}
          style={{ width: `${Math.min(volume * 200, 100)}%` }}
        />
      </div>

      {/* Label */}
      <span className={`text-xs font-medium ${color}`}>{text}</span>
    </div>
  );
}
