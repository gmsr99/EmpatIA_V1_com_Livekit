'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ScrollIndicator } from '@/components/scroll-indicator';

export function VideoHero() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black font-sans">
      {/* Local Video Background */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover opacity-60 mix-blend-screen"
        >
          <source src="/Teaser_Website_Hero.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Modern Gradient Overlay - Top Fade */}
      <div className="from-background to-background pointer-events-none absolute inset-0 z-10 bg-gradient-to-b via-transparent" />
      {/* Radial Vignette */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_0%,var(--background)_100%)]" />

      {/* Content Container */}
      <div className="relative z-20 flex min-h-screen flex-col items-center justify-center px-4 pt-20 text-center">
        {/* Badge / Label */}
        <div className="animate-in fade-in slide-in-from-bottom-4 text-brand-lilac mb-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium backdrop-blur-md duration-700">
          <Sparkles className="h-4 w-4" />
          <span>A Sua Companhia de IA</span>
        </div>

        {/* Main Headline */}
        {/* Main Logo */}
        <div className="animate-in fade-in slide-in-from-bottom-6 relative h-20 w-full delay-150 duration-1000 sm:h-24 md:h-32 lg:h-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="EmpatIA Logo" className="h-full w-full object-contain" />
        </div>

        {/* Subheadline */}
        <p className="animate-in fade-in slide-in-from-bottom-6 text-muted-foreground/80 mt-2 max-w-2xl text-2xl font-thin italic delay-300 duration-1000 md:text-3xl">
          Sempre aqui!
        </p>

        {/* CTA Buttons */}
        <div className="animate-in fade-in zoom-in mt-12 flex flex-col items-center gap-4 delay-500 duration-1000 sm:flex-row">
          <Link
            href="#voice-agent"
            className="group bg-brand-signature hover:bg-brand-signature/90 focus:ring-brand-signature focus:ring-offset-background relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full px-8 font-medium text-white transition-all duration-300 hover:scale-105 focus:ring-2 focus:ring-offset-2 focus:outline-none"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-violet-600 to-indigo-600 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <span className="mr-2">Começar Agora</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            href="#overview"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 font-medium text-white backdrop-blur-lg transition-colors hover:bg-white/10"
          >
            Saber Mais
          </Link>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute right-0 bottom-10 left-0 z-20">
        <ScrollIndicator />
      </div>
    </div>
  );
}
