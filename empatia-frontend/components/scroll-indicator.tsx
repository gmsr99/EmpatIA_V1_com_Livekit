'use client';

import { ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';

export function ScrollIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2, duration: 1, repeat: Infinity, repeatType: 'reverse' }}
      className="text-brand-blue-deep/50 pointer-events-none absolute bottom-8 left-1/2 z-40 -translate-x-1/2"
    >
      <ChevronDown className="h-8 w-8 animate-bounce md:h-10 md:w-10" />
    </motion.div>
  );
}
