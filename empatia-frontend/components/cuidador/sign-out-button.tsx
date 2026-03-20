'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/cuidador' })}
      className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/50 transition-colors hover:border-white/20 hover:text-white"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sair
    </button>
  );
}
