'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Guide } from '@/components/guide/Guide';
import { FoodPass, TrailList } from '@/components/quests/Expeditions';
import { QuestList } from '@/components/quests/QuestList';
import { gameApi, type BadgeInfo, type Category, type CheckIn, type PlaceFeature } from '@/lib/api';
import { BADGE_XP, CATEGORY } from '@/lib/game';
import { cn } from '@/lib/utils';

function countBy<T>(items: T[], key: (x: T) => string) {
  const m: Record<string, number> = {};
  for (const x of items) m[key(x)] = (m[key(x)] ?? 0) + 1;
  return m;
}

/** Razítko v Pasu: inkoust v barvě kategorie, každé natočené trochu jinak (podle id, ať se nemění). */
function Stamp({ s }: { s: CheckIn }) {
  const { Icon, color } = CATEGORY[s.place.category];
  const tilt = ((s.id * 37) % 15) - 7;
  return (
    <Link href={`/place/${s.place.id}`} className="group grid place-items-center py-2" aria-label={`${s.place.name}, orazítkováno ${new Date(s.created_at).toLocaleDateString('cs-CZ')}`}>
      <div className="grid aspect-square w-full max-w-[124px] place-items-center rounded-full border-[2.5px] p-1.5 opacity-90 transition-transform group-active:scale-95"
        style={{ borderColor: color, color, transform: `rotate(${tilt}deg)` }}>
        <div className="grid h-full w-full place-items-center rounded-full border border-dashed px-2 text-center" style={{ borderColor: color }}>
          <div>
            <Icon className="mx-auto h-5 w-5" aria-hidden />
            <div className="mt-0.5 line-clamp-2 text-[11px] font-extrabold uppercase leading-tight">{s.place.name}</div>
            <div className="font-hand text-base leading-none">{new Date(s.created_at).toLocaleDateString('cs-CZ')}{s.is_demo && ' demo'}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function Meter({ value, max, color }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ background: color ?? 'var(--primary)', width: `${Math.min(100, (100 * value) / Math.max(1, max))}%` }} />
    </div>
  );
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

  if (!stamps) return <AppShell><p className="text-muted-foreground">Listuju Pasem…</p></AppShell>;

  const totalCat = countBy(places, (f) => f.properties.category);
  const mineCat = countBy(stamps, (s) => s.place.category);
  const totalOkres = countBy(places.filter((f) => f.properties.okres), (f) => f.properties.okres);
  const mineOkres = countBy(stamps, (s) => s.place.okres);

  return (
    <AppShell>
      <h1 className="text-3xl font-extrabold">Můj Pas</h1>
      <p className="mt-1 text-muted-foreground">{stamps.length} razítek z {places.length || '…'} míst kraje</p>

      {stamps.length === 0 ? (
        <Guide who="boza" className="mt-6"
          action={<Link href="/map" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Otevřít mapu</Link>}>
          Pas je zatím prázdný. Najdi na mapě místo blízko sebe, dojdi k němu a vyfoť ho. První razítko sem pak otisknu já.
        </Guide>
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-x-2 rounded-2xl border border-border bg-card p-3">
          {stamps.map((s) => <li key={s.id}><Stamp s={s} /></li>)}
        </ul>
      )}

      <h2 className="mt-10 text-xl font-bold">Úkoly</h2>
      <QuestList />

      <TrailList />
      <FoodPass />

      {badges.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-bold">Odznaky</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {badges.map((b) => (
              <li key={b.code} className={cn('rounded-2xl border p-3', b.awarded ? 'border-trail-yellow bg-trail-yellow/15' : 'border-border bg-card')}>
                <div className={cn('text-2xl', !b.awarded && 'grayscale opacity-60')} aria-hidden>{b.icon}</div>
                <div className="mt-1 font-semibold leading-tight">{b.name}{b.awarded && <span className="sr-only"> (získáno)</span>}</div>
                {!b.awarded && <div className="text-xs font-semibold text-primary">+{BADGE_XP} XP</div>}
                <div className="mt-0.5 text-sm leading-snug text-muted-foreground">{b.description}</div>
                {b.target != null && (
                  <div className="mt-2 flex items-center gap-2">
                    <Meter value={b.progress} max={b.target} />
                    <span className="text-xs tabular-nums text-muted-foreground">{Math.min(b.progress, b.target)}/{b.target}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-10 text-xl font-bold">Podle druhu místa</h2>
      <ul className="mt-3 divide-y divide-border">
        {(Object.keys(CATEGORY) as Category[]).map((c) => {
          const { Icon, label, color } = CATEGORY[c];
          return (
            <li key={c} className="flex items-center gap-3 py-2.5">
              <Icon className="h-5 w-5 shrink-0" style={{ color }} aria-hidden />
              <span className="w-32 shrink-0 text-sm leading-tight">{label}</span>
              <Meter value={mineCat[c] ?? 0} max={totalCat[c] ?? 1} color={color} />
              <span className="w-12 text-right text-sm tabular-nums">{mineCat[c] ?? 0}/{totalCat[c] ?? 0}</span>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 text-xl font-bold">Podle okresů</h2>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {Object.entries(totalOkres).filter(([, n]) => n > 5).map(([o, n]) => (
          <li key={o} className="rounded-2xl bg-muted p-3">
            <div className="text-sm text-muted-foreground">{o}</div>
            <div className="text-xl font-bold tabular-nums">{mineOkres[o] ?? 0}<span className="text-sm font-normal text-muted-foreground">/{n}</span></div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
