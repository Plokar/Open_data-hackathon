'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PetArt } from '@/components/pet/PetCard';
import { errorMessage, gameApi, type DexEntry, type PetType } from '@/lib/api';
import { CATEGORY, PET_TYPE, RARITY, rarityBg } from '@/lib/game';

/** Políčko diáře: objevený druh v barvě rarity, neobjevený jako šedý stín bez jména. */
function Cell({ d, i }: { d: DexEntry; i: number }) {
  if (!d.pet) {
    return (
      <li className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border px-1 pb-2 pt-1 text-center">
        {/* ponytail: stín je náhodný tvor typu, ne ten skutečný; vzhled stejně určuje seed, ne druh */}
        <PetArt type={d.type} seed={i * 7919 + 13} size={64} label="Neobjevený tvor" className="opacity-35 contrast-0" />
        <span className="text-xs font-bold text-muted-foreground">???</span>
      </li>
    );
  }
  return (
    <li className="flex flex-col items-center rounded-2xl border-2 px-1 pb-2 pt-1 text-center"
      style={{ background: rarityBg(d.pet.rarity, 30), borderColor: `color-mix(in oklab, ${RARITY[d.pet.rarity].color} 45%, var(--border))` }}>
      <PetArt type={d.type} type2={d.pet.type2} seed={d.pet.seed} stage={d.pet.stage} rarity={d.pet.rarity} size={64} label={d.species!} />
      <span className="w-full truncate text-xs font-bold">{d.species}</span>
      <span className="text-[10px] text-muted-foreground">{d.count}× · {RARITY[d.pet.rarity].label}</span>
    </li>
  );
}

export default function DexPage() {
  const [dex, setDex] = useState<DexEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    gameApi.dex().then(setDex).catch((e) => { setDex([]); setError(errorMessage(e)); });
  }, []);

  const found = dex?.filter((d) => d.pet).length ?? 0;
  const types = [...new Set(dex?.map((d) => d.type))] as PetType[];

  return (
    <AppShell>
      <Link href="/pets" className="-ml-1 inline-flex h-10 items-center gap-1 text-sm font-semibold text-primary">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Moji tvorové
      </Link>
      <h1 className="text-3xl font-extrabold">Tvor-diář</h1>
      {dex && dex.length > 0 && (
        <>
          <p className="mt-1 text-muted-foreground">Objeveno {found} z {dex.length} druhů. Který se vylíhne, rozhodne fotka, takže stejné místo může dát jiného tvora.</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={found} aria-valuemin={0} aria-valuemax={dex.length} aria-label="Objevené druhy">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(100 * found) / dex.length}%` }} />
          </div>
        </>
      )}
      {!dex && <p className="mt-2 text-muted-foreground">Listuju diářem…</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}

      {types.map((t) => {
        const items = dex!.map((d, i) => [d, i] as const).filter(([d]) => d.type === t);
        return (
          <section key={t} className="mt-7" aria-labelledby={`dex-${t}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 id={`dex-${t}`} className="text-lg font-bold" style={{ color: PET_TYPE[t].color }}>{PET_TYPE[t].label}</h2>
              <span className="text-sm tabular-nums text-muted-foreground">{items.filter(([d]) => d.pet).length}/{items.length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Líhnou se u: {items[0][0].where.map((c) => CATEGORY[c].label.toLowerCase()).join(', ')}</p>
            <ul className="mt-2 grid grid-cols-4 gap-2">
              {items.map(([d, i]) => <Cell key={i} d={d} i={i} />)}
            </ul>
          </section>
        );
      })}
    </AppShell>
  );
}
