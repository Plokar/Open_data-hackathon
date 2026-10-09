import type { Pet } from '@/lib/api';
import { PET_TYPE } from '@/lib/game';
import { PetArt } from '@/components/pet/PetCard';
import { cn } from '@/lib/utils';

export function PetPicker({ pets, value, onChange }: { pets: Pet[]; value: number | null; onChange: (id: number) => void }) {
  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label="Výběr PETa">
      {pets.map((p) => (
        <button key={p.id} role="radio" aria-checked={value === p.id} onClick={() => onChange(p.id)}
          className={cn('w-28 shrink-0 rounded-xl border-2 p-2 text-center', value === p.id ? 'border-primary bg-primary/10' : 'border-border')}>
          <div className="flex justify-center"><PetArt type={p.type} seed={p.seed} size={64} /></div>
          <div className="truncate text-xs font-semibold">{p.name}</div>
          <div className="text-[10px] text-muted-foreground">{PET_TYPE[p.type].label} · lvl {p.level}{p.is_demo ? ' · demo' : ''}</div>
        </button>
      ))}
    </div>
  );
}
