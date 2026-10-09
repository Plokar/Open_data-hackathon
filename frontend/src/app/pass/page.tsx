'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { QuestList } from '@/components/quests/QuestList';
import { gameApi, type BadgeInfo, type Category, type CheckIn, type PlaceFeature } from '@/lib/api';
import { CATEGORY } from '@/lib/game';
import { cn } from '@/lib/utils';

function countBy<T>(items: T[], key: (x: T) => string) {
  const m: Record<string, number> = {};
  for (const x of items) m[key(x)] = (m[key(x)] ?? 0) + 1;
  return m;
}

export default function PassPage() {
  const [stamps, setStamps] = useState<CheckIn[] | null>(null);
  const [places, setPlaces] = useState<PlaceFeature[]>([]);
  const [badges, setBadges] = useState<BadgeInfo[]>([]);

  useEffect(() => {
    gameApi.myCheckins().then(setStamps).catch(() => setStamps([]));
    gameApi.places().then((d) => setPlaces(d.features)).catch(() => {});
    gameApi.badges().then(setBadges).catch(() => {});
  }, []);

  if (!stamps) return <AppShell><p className="text-sm text-muted-foreground">Načítám Pas…</p></AppShell>;

  const totalCat = countBy(places, (f) => f.properties.category);
  const mineCat = countBy(stamps, (s) => s.place.category);
  const totalOkres = countBy(places.filter((f) => f.properties.okres), (f) => f.properties.okres);
  const mineOkres = countBy(stamps, (s) => s.place.okres);

  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold">Můj Pas</h1>
      <p className="text-sm text-muted-foreground">{stamps.length} razítek z {places.length} míst kraje</p>

      <h2 className="mt-5 font-bold">Questy</h2>
      <QuestList />

      <h2 className="mt-5 font-bold">Odznaky</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {badges.map((b) => (
          <div key={b.code} className={cn('rounded-xl border p-3', b.awarded ? 'border-yellow-400 bg-yellow-400/10' : 'border-border opacity-80')}>
            <div className="text-2xl" aria-hidden>{b.icon}</div>
            <div className="text-sm font-semibold">{b.name} {b.awarded && <span className="sr-only">(získáno)</span>}</div>
            <div className="text-[11px] text-muted-foreground">{b.description}</div>
            {b.target != null && (
              <div className="mt-2">
                <div className="h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(100, (100 * b.progress) / Math.max(1, b.target))}%` }} />
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{Math.min(b.progress, b.target)} / {b.target}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-5 font-bold">Podle kategorií</h2>
      <div className="mt-2 space-y-2">
        {(Object.keys(CATEGORY) as Category[]).map((c) => (
          <div key={c} className="flex items-center gap-3 text-sm">
            <span className="w-6 text-center" aria-hidden>{CATEGORY[c].icon}</span>
            <span className="w-44 shrink-0">{CATEGORY[c].label}</span>
            <div className="h-2 flex-1 rounded-full bg-muted">
              <div className="h-2 rounded-full" style={{ background: CATEGORY[c].color, width: `${(100 * (mineCat[c] ?? 0)) / Math.max(1, totalCat[c] ?? 1)}%` }} />
            </div>
            <span className="w-14 text-right tabular-nums text-xs">{mineCat[c] ?? 0}/{totalCat[c] ?? 0}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-5 font-bold">Podle okresů</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(totalOkres).filter(([, n]) => n > 5).map(([o, n]) => (
          <div key={o} className="rounded-xl bg-muted p-3 text-center">
            <div className="text-xs text-muted-foreground">{o}</div>
            <div className="text-lg font-bold">{mineOkres[o] ?? 0}<span className="text-xs font-normal text-muted-foreground"> / {n}</span></div>
          </div>
        ))}
      </div>

      <h2 className="mt-5 font-bold">Razítka</h2>
      {stamps.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Zatím prázdno. <Link href="/map" className="text-primary underline">Najdi místo na mapě</Link>.</p>
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stamps.map((s) => (
            <li key={s.id}>
              <Link href={`/place/${s.place.id}`} className="block h-full rotate-[-1deg] rounded-xl border-2 border-dashed p-3 text-center"
                style={{ borderColor: CATEGORY[s.place.category].color }}>
                <div className="text-2xl" aria-hidden>{CATEGORY[s.place.category].icon}</div>
                <div className="text-xs font-semibold leading-tight">{s.place.name}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString('cs-CZ')}{s.is_demo && ' · demo'}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
