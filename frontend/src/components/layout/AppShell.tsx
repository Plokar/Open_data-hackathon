'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, BookOpen, PawPrint, Swords, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Logo, TrailMark, type TrailColor } from '@/components/brand/TrailMark';
import { cn } from '@/lib/utils';

const NAV: { href: string; label: string; icon: typeof Map; trail: TrailColor }[] = [
  { href: '/map', label: 'Mapa', icon: Map, trail: 'blue' },
  { href: '/pass', label: 'Pas', icon: BookOpen, trail: 'red' },
  { href: '/pets', label: 'Tvorové', icon: PawPrint, trail: 'green' },
  { href: '/battle', label: 'Souboj', icon: Swords, trail: 'yellow' },
  { href: '/leaderboard', label: 'Žebříček', icon: Trophy, trail: 'blue' },
];

export function AppShell({ children, fullBleed = false }: { children: React.ReactNode; fullBleed?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-[1000] border-b border-border bg-background/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between pl-4 pr-2">
          <Logo className="text-base" />
          <div className="flex items-center gap-1">
            {user ? (
              <Link href={`/u/${user.profile.nickname}`}
                className="flex h-11 items-center gap-2 rounded-full pl-3 pr-1 text-sm font-semibold hover:bg-accent">
                <span className="max-w-28 truncate">{user.first_name || user.profile.nickname}</span>
                <span className="grid h-8 min-w-8 place-items-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground" aria-label={`úroveň ${user.profile.level}`}>
                  {user.profile.level}
                </span>
              </Link>
            ) : (
              <Link href="/start" className="flex h-11 items-center rounded-full px-4 text-sm font-semibold text-primary hover:bg-accent">
                Začít
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className={cn('flex-1', fullBleed ? 'pb-[calc(4rem+env(safe-area-inset-bottom))]' : 'mx-auto w-full max-w-md px-4 pb-28 pt-5')}>
        {children}
      </main>

      {!fullBleed && (
        <footer className="mx-auto w-full max-w-md px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-xs leading-relaxed text-muted-foreground">
          Místa z <a className="underline" href="https://www.datazapad.cz" target="_blank" rel="noreferrer">DATA ZÁPAD</a> (Karlovarský kraj, CC0), mapa © OpenStreetMap.{' '}
          <Link className="underline" href="/insights">Co hráči objevují</Link>, <Link className="underline" href="/privacy">soukromí</Link>.
        </footer>
      )}

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-[1000] border-t border-border bg-background/95 backdrop-blur-md" aria-label="Hlavní navigace">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5">
          {NAV.map(({ href, label, icon: Icon, trail }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                className={cn('flex flex-col items-center justify-center gap-0.5 text-xs font-semibold',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <span className="flex h-3 items-start">{active && <TrailMark color={trail} className="h-2.5" />}</span>
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
