'use client';

import { useEffect, useState } from 'react';
import { Bandage, Sparkles } from 'lucide-react';
import type { Pet, PetStats, PetType, Rarity } from '@/lib/api';
import { PET_TYPE, RARITY } from '@/lib/game';
import { ELEMENT_GLOW, petDataUrl } from '@/lib/petArt';
import { cn } from '@/lib/utils';

/** Ilustrace tvora z generátoru (lib/petArt): stavba, doplňky a barvy ze seedu, vzhled podle evoluce a rarity. */
export function PetArt({ type, seed, size = 120, label, stage = 1, rarity = 'common', back = false, className }: {
  type: PetType; seed: number; size?: number; label?: string; stage?: number; rarity?: Rarity; back?: boolean; className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- lokální data URL SVG, next/image tu nic nepřidá
    <img src={petDataUrl({ type, seed, stage, rarity, back })} width={size} height={size} alt={label ?? `Tvor typu ${PET_TYPE[type].label}`}
      className={className} draggable={false} />
  );
}

const STAT_ROWS: [keyof PetStats, string, number][] = [
  ['hp', 'Život', 320], ['atk', 'Útok', 70], ['defense', 'Obrana', 45],
  ['mag', 'Magie', 70], ['spd', 'Rychlost', 40], ['stamina', 'Výdrž', 260],
];

/** Odpočet zranění; vrací null, když je tvor zdravý. */
export function useInjury(until: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [until]);
  const ms = until ? new Date(until).getTime() - now : 0;
  return ms > 0 ? Math.ceil(ms / 60000) : null;
}

export function PetCard({ pet, className, children, onEvolve }: {
  pet: Pet; className?: string; children?: React.ReactNode; onEvolve?: () => void;
}) {
  const t = PET_TYPE[pet.type];
  const injured = useInjury(pet.injured_until);
  const glow = ELEMENT_GLOW[pet.type];
  const xpPct = pet.xp_next ? Math.round((100 * (pet.xp - pet.xp_level)) / (pet.xp_next - pet.xp_level)) : 100;
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border bg-card', className)}>
      <div className="relative flex justify-center overflow-hidden pt-3"
        style={{ background: `radial-gradient(120% 90% at 50% 100%, color-mix(in oklab, ${glow} 30%, transparent), transparent 70%), color-mix(in oklab, ${t.color} 14%, var(--card))` }}>
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', RARITY[pet.rarity].className)}>{RARITY[pet.rarity].label}</span>
          <span className="rounded-full bg-card/80 px-2 py-0.5 text-xs font-semibold">{pet.stage_label}</span>
          {pet.is_demo && <span className="rounded-full bg-trail-yellow/30 px-2 py-0.5 text-xs font-semibold">demo</span>}
          {!pet.verified && !pet.is_demo && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">neověřený</span>}
        </div>
        <span className="absolute right-3 top-3 z-10 font-hand text-2xl leading-none" style={{ color: t.color }}>lvl {pet.level}</span>
        <PetArt type={pet.type} seed={pet.seed} stage={pet.stage} rarity={pet.rarity} size={170}
          className={cn('pet-idle', injured && 'opacity-60 grayscale')} />
        {injured && (
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-xl bg-background/90 py-1.5 text-sm font-semibold text-destructive">
            <Bandage className="h-4 w-4" aria-hidden /> Zraněný, léčí se ještě {injured} min
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="text-lg font-bold leading-tight">{pet.name}</div>
        <div className="text-sm text-muted-foreground">{pet.species}, typ {t.label.toLowerCase()}</div>

        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>XP {pet.xp}</span>
            <span>{pet.xp_next ? `další level za ${pet.xp_next - pet.xp}` : 'maximální level'}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted" role="progressbar" aria-valuenow={xpPct} aria-valuemin={0} aria-valuemax={100} aria-label="Postup na další level">
            <div className="h-2 rounded-full" style={{ width: `${xpPct}%`, background: t.color }} />
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-muted p-3">
          {STAT_ROWS.map(([k, label, max]) => (
            <div key={k} className="flex items-center gap-2">
              <dt className="w-16 text-[11px] text-muted-foreground">{label}</dt>
              <dd className="flex flex-1 items-center gap-1.5">
                <span className="w-8 text-right text-sm font-bold tabular-nums">{pet.stats[k]}</span>
                <span className="h-1.5 flex-1 rounded-full bg-background">
                  <span className="block h-1.5 rounded-full" style={{ width: `${Math.min(100, (100 * pet.stats[k]) / max)}%`, background: k === 'mag' ? glow : t.color }} />
                </span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Útoky">
          {pet.moves.map((m) => (
            <span key={m.id} className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', m.kind === 'magic' ? 'text-white' : 'bg-muted')}
              style={m.kind === 'magic' ? { background: `linear-gradient(135deg, ${t.color}, color-mix(in oklab, ${glow} 70%, ${t.color}))` } : undefined}
              title={`${m.power ? `síla ${m.power}, ` : ''}výdrž ${m.cost}`}>
              {m.kind === 'magic' && '✦ '}{m.name}
            </span>
          ))}
          {pet.stage < 3 && <span className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground">+ kouzlo po evoluci</span>}
        </div>

        {pet.can_evolve && onEvolve ? (
          <button onClick={onEvolve}
            className="evolve-cta mt-4 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl font-bold text-white"
            style={{ background: `linear-gradient(110deg, ${t.color}, ${glow}, ${t.color})`, backgroundSize: '200% 100%' }}>
            <Sparkles className="h-5 w-5" aria-hidden /> Evoluce!
          </button>
        ) : pet.evolve_level && (
          <p className="mt-3 text-xs text-muted-foreground">Evoluce na level {pet.evolve_level}.</p>
        )}

        {pet.lore && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{pet.lore}</p>}
        {children}
      </div>
    </div>
  );
}
