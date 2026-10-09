import type { Pet, PetType } from '@/lib/api';
import { PET_TYPE, RARITY } from '@/lib/game';
import { cn } from '@/lib/utils';

/** Deterministická ilustrace PETa: tvar podle typu, barvy a detaily ze seedu. */
export function PetArt({ type, seed, size = 120 }: { type: PetType; seed: number; size?: number }) {
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
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`Ilustrace PETa typu ${PET_TYPE[type].label}`}>
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

export function PetCard({ pet, className, children }: { pet: Pet; className?: string; children?: React.ReactNode }) {
  const t = PET_TYPE[pet.type];
  return (
    <div className={cn('rounded-2xl border-2 bg-card p-4', className)} style={{ borderColor: t.color }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-bold leading-tight">{pet.name}</div>
          <div className="text-xs text-muted-foreground">{pet.species} · {t.label} · lvl {pet.level}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', RARITY[pet.rarity].className)}>{RARITY[pet.rarity].label}</span>
          {pet.is_demo && <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:text-orange-300">demo</span>}
          {!pet.verified && !pet.is_demo && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">neověřený</span>}
        </div>
      </div>
      <div className="my-2 flex justify-center"><PetArt type={pet.type} seed={pet.seed} /></div>
      <dl className="grid grid-cols-4 gap-1 text-center text-xs">
        {([['HP', pet.hp], ['Útok', pet.atk], ['Obrana', pet.defense], ['Rychlost', pet.spd]] as const).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-muted py-1"><dt className="text-muted-foreground">{k}</dt><dd className="font-bold">{v}</dd></div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">{pet.lore}</p>
      {children}
    </div>
  );
}
