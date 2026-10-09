'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, BookOpen, PawPrint, Swords, Trophy, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/map', label: 'Mapa', icon: Map },
  { href: '/pass', label: 'Pas', icon: BookOpen },
  { href: '/pets', label: 'PETi', icon: PawPrint },
  { href: '/battle', label: 'Souboj', icon: Swords },
  { href: '/leaderboard', label: 'Žebříček', icon: Trophy },
];

export function AppShell({ children, fullBleed = false }: { children: React.ReactNode; fullBleed?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-[1000] flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur">
        <Link href="/" className="font-extrabold tracking-tight">
          ZÁPAD <span className="text-primary">GO</span>
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <Link href={`/u/${user.profile.nickname}`} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
              {user.profile.nickname} · lvl {user.profile.level}
            </Link>
          ) : (
            <Link href="/login" className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              <LogIn className="h-3.5 w-3.5" /> Přihlásit
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className={cn('flex-1 pb-16', !fullBleed && 'mx-auto w-full max-w-3xl px-4 py-4')}>{children}</main>

      {!fullBleed && (
        <footer className="px-4 pb-20 pt-2 text-center text-[11px] text-muted-foreground">
          Data: <a className="underline" href="https://www.datazapad.cz" target="_blank" rel="noreferrer">DATA ZÁPAD</a> (Karlovarský kraj, CC0) · Mapa © OpenStreetMap ·{' '}
          <Link className="underline" href="/privacy">Soukromí</Link> · <Link className="underline" href="/insights">Co hráči objevují</Link>
        </footer>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-[1000] grid h-16 grid-cols-5 border-t border-border bg-background/95 backdrop-blur" aria-label="Hlavní navigace">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined}
              className={cn('flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium', active ? 'text-primary' : 'text-muted-foreground')}>
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
