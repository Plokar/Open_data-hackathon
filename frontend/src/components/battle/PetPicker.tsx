'use client';

import { Bandage } from 'lucide-react';
import type { Pet } from '@/lib/api';
import { PET_TYPE } from '@/lib/game';
import { PetArt, useInjury } from '@/components/pet/PetCard';
import { cn } from '@/lib/utils';

function Option({ p, checked, onChange }: { p: Pet; checked: boolean; onChange: (id: number) => void }) {
  const injured = useInjury(p.injured_until);
  return (
    <button role="radio" aria-checked={checked} onClick={() => onChange(p.id)} disabled={!!injured}
      className={cn('relative w-28 shrink-0 cursor-pointer rounded-2xl border-2 bg-card p-2 text-center disabled:cursor-not-allowed',
        checked ? 'border-primary bg-primary/10' : 'border-border')}>
      <div className={cn('flex justify-center', injured && 'opacity-50 grayscale')}>
        <PetArt type={p.type} seed={p.seed} stage={p.stage} rarity={p.rarity} size={72} />
      </div>
      <div className="truncate text-sm font-semibold">{p.name}</div>
      <div className="text-xs text-muted-foreground">{PET_TYPE[p.type].label}, lvl {p.level}{p.is_demo ? ', demo' : ''}</div>
      {injured && (
        <div className="absolute inset-x-1 top-1 flex items-center justify-center gap-1 rounded-lg bg-destructive/90 py-0.5 text-[11px] font-semibold text-white">
          <Bandage className="h-3 w-3" aria-hidden /> {injured} min
        </div>
      )}
    </button>
  );
}

export function PetPicker({ pets, value, onChange }: { pets: Pet[]; value: number | null; onChange: (id: number) => void }) {
  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label="Výběr tvora">
      {pets.map((p) => <Option key={p.id} p={p} checked={value === p.id} onChange={onChange} />)}
    </div>
  );
}

export const isInjured = (p: Pet) => !!p.injured_until && new Date(p.injured_until).getTime() > Date.now();
