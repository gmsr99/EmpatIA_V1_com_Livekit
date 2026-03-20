'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '#overview', label: 'O Projeto' },
    { href: '#founders', label: 'Quem Somos' },
    { href: '#contact', label: 'Contactos' },
  ];

  return (
    <header
      className={cn(
        'fixed top-0 right-0 left-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300',
        scrolled
          ? 'border-b border-white/5 bg-black/50 shadow-lg backdrop-blur-md'
          : 'bg-transparent'
      )}
    >
      {/* Logo */}
      <Link
        href="/"
        className={cn(
          'transition-opacity duration-300',
          scrolled ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        <div className="relative aspect-[3/1] h-8 w-auto">
          <Image
            src="/logo.png"
            alt="EmpatIA Logo"
            width={120}
            height={40}
            className="h-full w-auto object-contain brightness-0 invert"
            priority
          />
        </div>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden items-center gap-8 md:flex">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="hover:text-brand-lilac text-sm font-medium text-white/80 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Mobile toggle */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="hover:text-brand-lilac p-2 text-white transition-colors"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute top-full right-0 left-0 overflow-hidden border-b border-white/10 bg-black/90 shadow-lg backdrop-blur-xl md:hidden"
          >
            <nav className="flex flex-col space-y-4 p-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-brand-lilac py-2 text-lg font-medium text-white transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
