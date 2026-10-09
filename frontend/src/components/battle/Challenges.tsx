'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Swords } from 'lucide-react';
import { PetArt } from '@/components/pet/PetCard';
import { battleApi, type Challenge } from '@/lib/api';

/** Výzvy od přátel, které na mě čekají. Obnovuje se každých 10 s (ponytail: polling místo notifikací přes WS). */
export function Challenges({ className }: { className?: string }) {
  const [list, setList] = useState<Challenge[]>([]);
  useEffect(() => {
    const load = () => battleApi.challenges().then(setList).catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);
  if (!list.length) return null;
  return (
    <section className={className} aria-label="Výzvy od přátel">
      <h2 className="flex items-center gap-2 font-semibold"><Swords className="h-4 w-4 text-trail-red" aria-hidden /> Výzvy od přátel</h2>
      <div className="mt-2 space-y-2">
        {list.map((c) => (
          <Link key={c.battle_id} href={`/battle/${c.battle_id}`}
            className="flex items-center gap-3 rounded-2xl border-2 border-trail-red/40 bg-trail-red/5 p-2.5 pr-3">
            {c.pet && <PetArt type={c.pet.type} seed={c.pet.seed} stage={c.pet.stage} rarity={c.pet.rarity} size={52} />}
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{c.from}</div>
              <div className="truncate text-xs text-muted-foreground">{c.pet ? `posílá ${c.pet.name}, lvl ${c.pet.level}` : 'tě vyzývá'}</div>
            </div>
            <span className="rounded-xl bg-trail-red px-3 py-2 text-sm font-bold text-white">Přijmout</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
