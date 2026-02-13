'use client';

import { useEffect, useRef } from 'react';

interface GlowingRingVisualizerProps {
  stream?: MediaStream;
  height?: string;
  width?: string;
}

export function GlowingRingVisualizer({
  stream,
  height = '300px',
  width = '300px',
}: GlowingRingVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Only set up audio context if we have a stream
    if (stream) {
      // Initialize Audio Context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      // Create Analyser
      if (!analyserRef.current) {
        analyserRef.current = audioCtx.createAnalyser();
        analyserRef.current.fftSize = 512; // Increased for better resolution
        analyserRef.current.smoothingTimeConstant = 0.92; // High smoothing for creamy motion
      }

      // Connect Stream
      try {
        if (sourceRef.current) {
          sourceRef.current.disconnect();
        }
        sourceRef.current = audioCtx.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);
      } catch (err) {
        console.error('Error creating media stream source:', err);
      }
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Responsive Canvas sizing
    const resizeCanvas = () => {
      const { clientWidth, clientHeight } = containerRef.current!;
      canvas.width = clientWidth * 2; // Retina scaling
      canvas.height = clientHeight * 2;
      ctx.scale(2, 2);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let phase = 0;
    // Buffer for frequency data if needed
    let dataArray: Uint8Array | null = null;
    if (analyserRef.current) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
    }

    const renderFrame = () => {
      animationRef.current = requestAnimationFrame(renderFrame);

      let normalizedEnergy = 0;

      // If we have an active stream and analyser, get real data
      if (stream && analyserRef.current && dataArray) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        analyserRef.current.getByteFrequencyData(dataArray as any);

        // Soft average of low-mids for a more "voice-reactive" feel rather than just sub-bass
        let energy = 0;
        const rangeStart = 2;
        const rangeEnd = 25; // Focus on voice fundamental frequencies
        for (let i = rangeStart; i < rangeEnd; i++) {
          energy += dataArray[i];
        }
        energy = energy / (rangeEnd - rangeStart);
        normalizedEnergy = energy / 255; // 0 to 1
      }

      const { width, height } = containerRef.current!.getBoundingClientRect();
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 3.2; // Increased size relative to container

      ctx.clearRect(0, 0, width, height);

      // Composition mode for glow
      ctx.globalCompositeOperation = 'lighter';

      // Draw multiple organic rings - thinner, smoother, elegant
      // Layer 1: Core White/Lilac (Bright center)
      drawOrganicRing(
        ctx,
        centerX,
        centerY,
        radius * 0.95,
        normalizedEnergy,
        phase,
        '#f3e8ff',
        0.8
      );

      // Layer 2: Main Violet (Inner)
      drawOrganicRing(ctx, centerX, centerY, radius, normalizedEnergy, phase + 1, '#a855f7', 0.6);

      // Layer 3: Main Cyan (Inner-Mid) - Offset rotation
      drawOrganicRing(
        ctx,
        centerX,
        centerY,
        radius * 1.02,
        normalizedEnergy * 0.9,
        phase + 2.5,
        '#22d3ee',
        0.5
      );

      // Layer 4: Outer Violet (Ghost)
      drawOrganicRing(
        ctx,
        centerX,
        centerY,
        radius * 1.05,
        normalizedEnergy * 0.8,
        phase + 4,
        '#a855f7',
        0.3
      );

      // Layer 5: Outer Cyan (Ghost) - widest
      drawOrganicRing(
        ctx,
        centerX,
        centerY,
        radius * 1.1,
        normalizedEnergy * 0.7,
        phase + 5.5,
        '#22d3ee',
        0.2
      );

      ctx.globalCompositeOperation = 'source-over';

      phase += 0.015; // Even slower, majestic rotation
    };

    const drawOrganicRing = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      r: number,
      intensity: number,
      offset: number,
      color: string,
      opacity: number
    ) => {
      ctx.beginPath();
      const segments = 120;

      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;

        // Reduced noise factors for a "clean" look.
        // Less high-frequency noise, more slow-moving deformation.
        const noise = Math.sin(angle * 3 + offset) * 0.5 + Math.cos(angle * 5 - offset * 0.8) * 0.3;

        // Idle "Breathing" Effect
        const idleBreath = Math.sin(offset * 0.5) * 2; // Slow pulsation

        // Dynamic amplitude based on audio intensity + base breathing
        const baseAmplitude = 5 + idleBreath; // Always moving slightly
        const responsiveAmplitude = intensity * 30; // Stronger reaction when speaking

        const amplitude = baseAmplitude + responsiveAmplitude;

        // We use Math.max(0.1, intensity) to ensure the noise always deforms the circle slightly
        const deformation = Math.max(0.2, Math.pow(intensity, 0.4));

        const currentRadius = r + noise * amplitude * deformation + idleBreath * 1.5; // Add breath to radius directly too

        const x = cx + Math.cos(angle) * currentRadius;
        const y = cy + Math.sin(angle) * currentRadius;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();

      // Refined Styles
      ctx.strokeStyle = color;
      // Laser thin lines
      ctx.lineWidth = 1 + intensity * 1.5;
      ctx.lineCap = 'round';
      // Softer, wider glow
      ctx.shadowBlur = 10 + intensity * 10;
      ctx.shadowColor = color;
      ctx.globalAlpha = opacity;
      ctx.stroke();
    };

    renderFrame();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationRef.current);
      if (sourceRef.current) sourceRef.current.disconnect();
      // Do not close AudioContext as it might be shared or reused, but disconnecting implementation is enough for now.
    };
  }, [stream]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center"
      style={{ height, width }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
