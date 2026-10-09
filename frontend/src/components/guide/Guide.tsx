import type { PetType } from '@/lib/api';
import { PET_TYPE } from '@/lib/game';
import { cn } from '@/lib/utils';

/**
 * Kresba maskotů aplikace (průvodci, ukázky typů v onboardingu). Záměrně oddělená od generátoru
 * tvorů (lib/petArt), aby se maskoti neměnili s vývojem tvorů.
 */
export function MascotArt({ type, seed, size = 120, label }: { type: PetType; seed: number; size?: number; label?: string }) {
  const n = (k: number) => Math.floor(seed / 7 ** k) % 1000;
  const hue = n(1) % 360;
  const base = PET_TYPE[type].color;
  const eyeY = 54 + (n(2) % 6);
  const wide = 30 + (n(3) % 8);
  const hats: Record<PetType, React.ReactNode> = {
    fortress: <path d="M30 34h60v-12h-10v6h-8v-6h-8v6h-8v-6h-8v6h-8v-6H30z" fill={base} stroke="#0003" />,
    view: <><line x1="60" y1="30" x2="60" y2="10" stroke={base} strokeWidth="4" /><circle cx="60" cy="9" r="6" fill={`hsl(${hue} 80% 60%)`} /></>,
    nature: <path d="M60 32c-18-4-22-20-10-26 4 12 16 14 10 26zm0 0c14-6 26-2 26 8-10 0-20 2-26-8z" fill="#22c55e" />,
    spring: <path d="M60 4c8 12 12 18 12 24a12 12 0 0 1-24 0c0-6 4-12 12-24z" fill="#38bdf8" />,
    culture: <path d="M38 34l6-18 8 10 8-14 8 14 8-10 6 18z" fill="#facc15" stroke="#0003" />,
    taste: <circle cx="60" cy="22" r="11" fill="none" stroke="#d97706" strokeWidth="6" strokeDasharray="10 4" />,
  };
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={label ?? `Tvor typu ${PET_TYPE[type].label}`}>
      <ellipse cx="60" cy="112" rx="30" ry="5" fill="#0002" />
      <ellipse cx="60" cy="70" rx={wide} ry="38" fill={base} />
      <ellipse cx="60" cy="80" rx={wide - 12} ry="22" fill={`hsl(${hue} 70% 85%)`} opacity="0.9" />
      {hats[type]}
      <circle cx={60 - 12} cy={eyeY} r="7" fill="#fff" />
      <circle cx={60 + 12} cy={eyeY} r="7" fill="#fff" />
      <circle cx={60 - 11 + (n(4) % 3)} cy={eyeY + 1} r="3.5" fill="#111" />
      <circle cx={60 + 13 - (n(4) % 3)} cy={eyeY + 1} r="3.5" fill="#111" />
      <path d={`M52 ${eyeY + 14} q8 ${4 + (n(5) % 6)} 16 0`} stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="40" cy={eyeY + 10} r="4" fill={`hsl(${(hue + 340) % 360} 80% 70%)`} opacity="0.6" />
      <circle cx="80" cy={eyeY + 10} r="4" fill={`hsl(${(hue + 340) % 360} 80% 70%)`} opacity="0.6" />
    </svg>
  );
}

/** Tři průvodci aplikací. Seedy odpovídají původním ilustracím z úvodní stránky. */
export const GUIDES = {
  kukadlo: { name: 'Kukadlo', type: 'view', seed: 555555555, role: 'hlídá rozhledny a mapu' },
  boza: { name: 'Bóža', type: 'fortress', seed: 123456789, role: 'správce hradů a razítek' },
  vridla: { name: 'Vřídla', type: 'spring', seed: 987654321, role: 'strážkyně pramenů a tvorů' },
} as const satisfies Record<string, { name: string; type: PetType; seed: number; role: string }>;

export type GuideId = keyof typeof GUIDES;

export function GuideAvatar({ who, size = 64, className }: { who: GuideId; size?: number; className?: string }) {
  const g = GUIDES[who];
  return (
    <span className={cn('inline-block shrink-0', className)}>
      <MascotArt type={g.type} seed={g.seed} size={size} label={`${g.name}, ${g.role}`} />
    </span>
  );
}

/** Průvodce s bublinou. Používá se v prázdných stavech a tipech, kde je potřeba něco vysvětlit. */
export function Guide({ who, children, action, className }: {
  who: GuideId;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-end gap-2', className)}>
      <GuideAvatar who={who} size={60} className="-mb-1" />
      <div className="relative min-w-0 flex-1 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 shadow-[0_6px_16px_-10px_rgb(28_43_34/0.35)]">
        <div className="font-hand text-xl leading-none text-primary">{GUIDES[who].name}</div>
        <div className="mt-1 text-[15px] leading-snug">{children}</div>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
