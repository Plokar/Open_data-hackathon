import Link from 'next/link';
import { cn } from '@/lib/utils';

export type TrailColor = 'red' | 'blue' | 'green' | 'yellow';

/** Turistická značka KČT: bílá, barva, bílá. Podpisový prvek celé aplikace. */
export function TrailMark({ color = 'red', className }: { color?: TrailColor; className?: string }) {
  return (
    <svg viewBox="0 0 30 21" className={cn('h-[1.1em] w-auto shrink-0', className)} aria-hidden>
      <rect x="0.5" y="0.5" width="29" height="20" rx="2" fill="#fbfcf8" stroke="rgb(28 43 34 / 0.18)" />
      <rect x="0.5" y="7" width="29" height="7" fill={`var(--trail-${color})`} />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('inline-flex items-center gap-2 text-lg font-extrabold tracking-tight', className)}>
      <TrailMark color="red" />
      Západ GO
    </Link>
  );
}
