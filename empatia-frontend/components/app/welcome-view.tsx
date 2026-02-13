import { motion } from 'framer-motion';
import { MessageCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/livekit/button';

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  return (
    <div
      ref={ref}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-black font-sans"
    >
      {/* Ambient Background */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] opacity-20 blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="z-10 flex flex-col items-center space-y-8 text-center"
      >
        <div className="relative">
          <div className="bg-brand-signature/20 absolute -inset-4 animate-pulse rounded-full blur-xl" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md">
            <Sparkles className="text-brand-lilac h-10 w-10" />
          </div>
        </div>

        <div className="max-w-lg space-y-4 px-6">
          <h2 className="font-heading bg-gradient-to-br from-white to-white/60 bg-clip-text text-4xl text-transparent md:text-5xl">
            Olá, sou a EmpatIA
          </h2>
          <p className="text-muted-foreground/90 text-xl font-light">
            Estou aqui para conversar consigo. Clique abaixo para começarmos.
          </p>
        </div>

        <Button
          variant="default"
          size="lg"
          onClick={onStartCall}
          className="group bg-brand-signature hover:bg-brand-signature/90 relative h-14 overflow-hidden rounded-full px-10 text-lg font-bold text-white shadow-[0_0_40px_rgba(147,51,234,0.3)] transition-all hover:scale-105"
        >
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-violet-600 to-indigo-600 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <span className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5" />
            {startButtonText}
          </span>
        </Button>
      </motion.div>
    </div>
  );
};
