'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PetArt } from '@/components/pet/PetCard';
import { useAuth } from '@/contexts/AuthContext';
import { gameApi, type Category } from '@/lib/api';
import { CATEGORY } from '@/lib/game';

export default function Home() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Partial<Record<Category, number>>>({});
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  useEffect(() => {
    gameApi.places().then((d) => {
      const c: Partial<Record<Category, number>> = {};
      for (const f of d.features) c[f.properties.category] = (c[f.properties.category] ?? 0) + 1;
      setCounts(c);
    }).catch(() => {});
  }, []);

  return (
    <AppShell>
      <section className="py-6 text-center">
        <div className="flex justify-center gap-1">
          <PetArt type="fortress" seed={123456789} size={72} />
          <PetArt type="spring" seed={987654321} size={72} />
          <PetArt type="view" seed={555555555} size={72} />
        </div>
        <h1 className="mt-3 text-4xl font-black tracking-tight">ZÁPAD <span className="text-primary">GO</span></h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Choď po Karlovarském kraji, razítkuj hrady, rozhledny, prameny i místní výrobce. Z každého místa ti vznikne
          <b className="text-foreground"> PET</b>, se kterým můžeš bojovat proti ostatním.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href={user ? '/map' : '/register'} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground">Začít hrát</Link>
          <Link href="/map" className="rounded-xl border border-border px-6 py-3 font-semibold">Prohlédnout mapu</Link>
        </div>
      </section>

      <section className="rounded-2xl bg-muted p-4">
        <h2 className="text-center text-sm font-semibold text-muted-foreground">
          {total ? `${total} míst z otevřených dat kraje` : 'Místa z otevřených dat kraje'}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(CATEGORY) as Category[]).map((c) => (
            <div key={c} className="rounded-xl bg-background p-3 text-center">
              <div className="text-2xl" aria-hidden>{CATEGORY[c].icon}</div>
              <div className="text-xl font-bold">{counts[c] ?? '–'}</div>
              <div className="text-[11px] text-muted-foreground">{CATEGORY[c].label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ['📍', 'Razítko jen na místě', 'Server ověří, že jsi do 300 m. Fotku místa vidíš jen ty.'],
          ['🚌', 'I bez auta', 'U každého místa ukážeme nejbližší autobusovou zastávku.'],
          ['🥨', 'Dobroty kraje', 'Navštiv oceněné místní výrobce a získej odznak Dobrotník.'],
        ].map(([i, t, d]) => (
          <div key={t} className="rounded-2xl border border-border p-4">
            <div className="text-2xl" aria-hidden>{i}</div>
            <div className="mt-1 font-semibold">{t}</div>
            <p className="text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
