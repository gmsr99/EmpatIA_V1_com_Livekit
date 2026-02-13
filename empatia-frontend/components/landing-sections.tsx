'use client';

import React from 'react';
import Image from 'next/image';
import { HandHeart, Heart, Mail, MessageCircle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { HomepageVoiceAgent } from '@/components/app/homepage-voice-agent';
import { cn } from '@/lib/utils';

// --- Types ---
interface SectionProps {
  className?: string;
  id?: string;
}

// --- Animation Variants ---
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

// --- Components ---

export function HeroPlaceholder({ className }: SectionProps) {
  // This placeholder helps visualizing where the Agent App sits
  return (
    <div
      className={cn(
        'pointer-events-none flex min-h-[100vh] flex-col items-center justify-center bg-transparent',
        className
      )}
    >
      <div className="to-background/20 pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent" />
      <h1 className="sr-only">EmpatIA - Sua companhia inteligente</h1>
    </div>
  );
}

export function OverviewSection({ className, id }: SectionProps) {
  return (
    <section id={id} className={cn('relative overflow-hidden px-6 py-24 md:px-12', className)}>
      <motion.div
        className="mx-auto max-w-5xl space-y-12 text-center"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={staggerContainer}
      >
        <motion.div variants={fadeInUp} className="space-y-4">
          {/* Section Label */}
          <div className="text-brand-lilac mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wider uppercase backdrop-blur-md">
            <Sparkles className="h-3 w-3" />
            <span>Sobre o Projeto</span>
          </div>

          <h2 className="font-heading text-4xl text-white md:text-5xl">
            O que é a <span className="text-brand-signature">EmpatIA?</span>
          </h2>
        </motion.div>

        <motion.p
          variants={fadeInUp}
          className="text-muted-foreground mx-auto max-w-3xl text-lg leading-relaxed md:text-xl"
        >
          A EmpatIA é mais do que tecnologia: é uma companhia sempre presente. Uma inteligência
          amiga que ouve, conversa e oferece apoio emocional, garantindo que o silêncio nunca toma
          conta do dia.
        </motion.p>

        <motion.div variants={staggerContainer} className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Card 1 */}
          <motion.div
            variants={fadeInUp}
            className="group hover:border-brand-signature/50 hover:shadow-brand-signature/10 relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 text-left shadow-2xl backdrop-blur-md transition-all duration-300 hover:bg-white/10"
          >
            <div className="bg-brand-signature/20 text-brand-lilac mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg">
              <MessageCircle className="h-6 w-6" />
            </div>
            <h3 className="font-heading mb-3 text-xl text-white">Claro e Simples</h3>
            <p className="text-muted-foreground group-hover:text-gray-300">
              Frases diretas e uma voz natural, fáceis de entender por qualquer idade.
            </p>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            variants={fadeInUp}
            className="group hover:border-brand-signature/50 hover:shadow-brand-signature/10 relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 text-left shadow-2xl backdrop-blur-md transition-all duration-300 hover:bg-white/10"
          >
            <div className="bg-brand-signature/20 text-brand-lilac mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg">
              <Heart className="h-6 w-6" />
            </div>
            <h3 className="font-heading mb-3 text-xl font-bold text-white">Suave e Emocional</h3>
            <p className="text-muted-foreground group-hover:text-gray-300">
              Acolhedora e atenciosa, mas equilibrada, sem excessos ou artificialidade.
            </p>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            variants={fadeInUp}
            className="group hover:border-brand-signature/50 hover:shadow-brand-signature/10 relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 text-left shadow-2xl backdrop-blur-md transition-all duration-300 hover:bg-white/10"
          >
            <div className="bg-brand-signature/20 text-brand-lilac mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg">
              <HandHeart className="h-6 w-6" />
            </div>
            <h3 className="font-heading mb-3 text-xl font-bold text-white">Sempre Presente</h3>
            <p className="text-muted-foreground group-hover:text-gray-300">
              Disponível 24/7 para ouvir, apoiar e transmitir empatia quando mais precisa.
            </p>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}

export function MissionSection({ className, id }: SectionProps) {
  return (
    <section id={id} className={cn('relative overflow-hidden px-6 py-24 md:px-12', className)}>
      <motion.div
        className="mx-auto flex max-w-6xl flex-col items-center gap-16 md:flex-row"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={staggerContainer}
      >
        <motion.div variants={fadeInUp} className="flex-1 space-y-8">
          <div className="text-brand-lilac flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wider uppercase backdrop-blur-md">
            <Heart className="h-3 w-3" />
            <span>Nossa Missão</span>
          </div>

          <h2 className="font-heading text-4xl text-white md:text-5xl">
            Acreditamos no poder da <span className="text-brand-signature">Escuta Ativa.</span>
          </h2>

          <div className="border-brand-signature relative border-l-4 pl-6">
            <blockquote className="text-2xl font-light text-white/90 italic">
              “Todos deveriam ter alguém para ouvir e ser ouvido.”
            </blockquote>
          </div>

          <p className="text-muted-foreground text-lg leading-relaxed">
            Acreditamos que a tecnologia pode ser uma ponte para o calor humano. A nossa missão é
            garantir que ninguém precise enfrentar os seus desafios sozinho. Através de conversas
            naturais e empáticas, oferecemos um porto seguro emocional.
          </p>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          className="flex w-full flex-1 justify-center md:justify-end"
        >
          <div className="relative h-[400px] w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 shadow-2xl backdrop-blur-sm transition-transform duration-500 hover:scale-[1.02]">
            <div className="from-background absolute inset-0 z-10 bg-gradient-to-t via-transparent to-transparent" />
            <Image src="/idosa.png" alt="Idosa a sorrir" fill className="rounded-xl object-cover" />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

export function CallToActionSection({ className, id }: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'relative scroll-mt-[35vh] overflow-hidden border-y border-white/5 bg-white/5 px-6 py-24 backdrop-blur-sm md:px-12',
        className
      )}
    >
      {/* Background Gradient */}
      <div className="from-brand-signature/10 absolute inset-0 bg-gradient-to-r to-transparent opacity-50" />

      {/* Modern Geometric Pattern (Tech/AI Lines) */}
      <div className="absolute inset-0 z-0 opacity-20">
        <svg
          className="h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 1000 400"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle Grid */}
          <defs>
            <pattern id="techGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-white/20"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#techGrid)" />

          {/* Accent Lines / Circuit Paths */}
          <path
            d="M 0 100 Q 250 50 500 100 T 1000 100"
            fill="none"
            stroke="url(#lineGradient1)"
            strokeWidth="1"
          />
          <path
            d="M 0 300 Q 250 350 500 300 T 1000 300"
            fill="none"
            stroke="url(#lineGradient1)"
            strokeWidth="1"
          />

          <defs>
            <linearGradient id="lineGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(168, 85, 247, 0)" />
              <stop offset="50%" stopColor="rgba(168, 85, 247, 0.5)" />
              <stop offset="100%" stopColor="rgba(34, 211, 238, 0)" />
            </linearGradient>
          </defs>

          {/* Floating Geometric Elements */}
          <circle
            cx="850"
            cy="100"
            r="150"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
          <circle
            cx="150"
            cy="300"
            r="100"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        </svg>
      </div>

      <motion.div
        className="relative z-10 mx-auto max-w-4xl space-y-10 text-center"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInUp}
      >
        <h2 className="font-heading text-4xl text-white md:text-5xl">Pronto para conversar?</h2>
        <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
          Descubra como a EmpatIA pode fazer a diferença hoje mesmo.
        </p>

        <div className="mt-8 flex justify-center">
          <HomepageVoiceAgent />
        </div>
      </motion.div>
    </section>
  );
}

export function FoundersSection({ className, id }: SectionProps) {
  const founders = [
    {
      name: 'Andrea',
      role: 'Co-Founder & Operations',
      image: '/team/Andrea.png',
    },
    {
      name: 'Elton',
      role: 'Co-Founder & Product',
      image: '/team/Elton.png',
    },
    {
      name: 'Gil',
      role: 'Co-Founder & Tech Lead',
      image: '/team/Gil.png',
    },
  ];

  return (
    <section id={id} className={cn('relative overflow-hidden py-24 md:py-32', className)}>
      <div className="relative z-10 container mx-auto px-6 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={staggerContainer}
        >
          <motion.h2 variants={fadeInUp} className="font-heading text-4xl text-white md:text-5xl">
            Quem Somos
          </motion.h2>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {founders.map((founder) => (
              <motion.div
                key={founder.name}
                variants={fadeInUp}
                className="group relative flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md transition-all hover:bg-white/10"
              >
                {/* Nationality Flag */}
                <div className="absolute top-4 left-4 text-xl opacity-80" title="Portugal">
                  🇵🇹
                </div>

                <div className="group-hover:border-brand-signature mb-6 h-32 w-32 overflow-hidden rounded-full border-2 border-white/20 shadow-lg transition-transform duration-300 group-hover:scale-110">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={founder.image}
                    alt={founder.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading text-2xl text-white">{founder.name}</h3>
                  <p className="text-brand-lilac font-medium tracking-wide">{founder.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function ContactSection({ className, id }: SectionProps) {
  return (
    <section id={id} className={cn('relative overflow-hidden px-6 py-24 md:px-12', className)}>
      {/* Footer Glow */}
      <div className="from-brand-signature/20 absolute inset-x-0 bottom-0 h-[500px] bg-gradient-to-t to-transparent blur-3xl" />

      <motion.div
        className="relative z-10 mx-auto max-w-4xl space-y-12 text-center"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInUp}
      >
        <div className="space-y-4">
          <h2 className="font-heading text-4xl text-white md:text-5xl">Estamos aqui para si</h2>
          <p className="text-muted-foreground text-xl font-light">
            Quer saber mais sobre a EmpatIA ou apenas dizer olá?
          </p>
        </div>

        <motion.a
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          href="mailto:hello@empatia-portugal.pt"
          className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-xl font-medium text-white backdrop-blur-md transition-colors hover:border-white/20 hover:bg-white/10"
        >
          <Mail className="text-brand-lilac h-6 w-6" />
          hello@empatia-portugal.pt
        </motion.a>

        <div className="text-muted-foreground/50 flex flex-col items-center justify-center gap-4 border-t border-white/10 pt-12 text-sm md:flex-row">
          <span>© {new Date().getFullYear()} EmpatIA. Todos os direitos reservados.</span>
          <div className="flex gap-4">
            <a href="/terms" className="transition-colors hover:text-white">
              Termos e Condições
            </a>
            <a href="/privacy" className="transition-colors hover:text-white">
              Política de Privacidade
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
