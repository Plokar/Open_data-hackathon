'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bus, Check, Croissant } from 'lucide-react';
import { teamApi, type FoodKind, type Trail } from '@/lib/api';
import { CATEGORY } from '@/lib/game';
import { cn } from '@/lib/utils';

const SHOWN = 4;
// rozdělané výpravy nahoře, hotové dole
const rank = (t: Trail) => (t.done ? 2 : t.progress > 0 ? 0 : 1);

function TrailCard({ t }: { t: Trail }) {
  return (
    <li className={cn('rounded-2xl border p-4', t.done ? 'border-trail-green/60 bg-trail-green/10' : 'border-border bg-card')}>
      <div className="flex items-start gap-3">
        <Bus className="mt-0.5 h-5 w-5 shrink-0 text-trail-blue" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold leading-tight">{t.stop}</span>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{t.progress}/{t.target}</span>
          </div>
          <div className="text-sm text-muted-foreground">okres {t.okres}{t.done && ', hotovo'}</div>
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {t.places.map((p) => {
          const { Icon, color } = CATEGORY[p.category];
          return (
            <li key={p.id}>
              <Link href={`/place/${p.id}`}
                className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm', p.stamped ? 'border-transparent bg-trail-green/20' : 'border-border')}>
                {p.stamped ? <Check className="h-4 w-4 text-trail-green" aria-hidden /> : <Icon className="h-4 w-4" style={{ color }} aria-hidden />}
                <span className={cn('max-w-[11rem] truncate', p.stamped && 'text-muted-foreground')}>{p.name}</span>
                {p.stamped && <span className="sr-only"> (v Pasu)</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/** Výpravy bez auta: místa u jedné autobusové zastávky. Dokončení dá odznak a vzácnějšího tvora. */
export function TrailList() {
  const [trails, setTrails] = useState<Trail[] | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    teamApi.trails().then(setTrails).catch(() => setTrails([]));
  }, []);
  if (!trails?.length) return null;
  const sorted = [...trails].sort((a, b) => rank(a) - rank(b));

  return (
    <>
      <h2 className="mt-10 text-xl font-bold">Výpravy bez auta</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Vystup na autobusové zastávce a obejdi všechna místa v okolí. Za dokončenou výpravu dostaneš odznak a tvora o stupeň vzácnějšího.
      </p>
      <ul className="mt-3 space-y-2">
        {(all ? sorted : sorted.slice(0, SHOWN)).map((t) => <TrailCard key={t.id} t={t} />)}
      </ul>
      {sorted.length > SHOWN && (
        <button type="button" onClick={() => setAll(!all)} className="mt-3 h-11 w-full rounded-xl bg-muted font-semibold">
          {all ? 'Skrýt ostatní výpravy' : `Ukázat všech ${sorted.length} výprav`}
        </button>
      )}
    </>
  );
}

/** Dobrotový pas: druhy oceněných Dobrot kraje. Razítko u výrobce odemkne jeho druhy. */
export function FoodPass() {
  const [kinds, setKinds] = useState<FoodKind[] | null>(null);
  useEffect(() => {
    teamApi.foodPass().then(setKinds).catch(() => setKinds([]));
  }, []);
  if (!kinds?.length) return null;
  const tasted = kinds.filter((k) => k.tasted).length;

  return (
    <>
      <h2 className="mt-10 text-xl font-bold">Dobrotový pas</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Oceněné Dobroty Karlovarského kraje mají {kinds.length} druhů, ochutnáno máš {tasted}. Navštiv místní výrobce a odemkni je všechny.
      </p>
      <ul className="mt-3 space-y-2">
        {kinds.map((k) => (
          <li key={k.name} className={cn('flex items-center gap-3 rounded-2xl border p-3', k.tasted ? 'border-trail-yellow bg-trail-yellow/15' : 'border-border bg-card')}>
            <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full border-2', k.tasted ? 'border-trail-yellow text-foreground' : 'border-border text-muted-foreground')}>
              {k.tasted ? <Check className="h-5 w-5" aria-hidden /> : <Croissant className="h-5 w-5" aria-hidden />}
            </span>
            <div className="min-w-0">
              <div className="font-semibold leading-tight">{k.name}{k.tasted && <span className="sr-only"> (ochutnáno)</span>}</div>
              <div className="text-sm text-muted-foreground">Výrobců v kraji: {k.producers}</div>
            </div>
          </li>
        ))}
      </ul>
      <Link href="/map" className="mt-3 inline-block text-sm font-semibold text-primary underline">Najít výrobce na mapě</Link>
    </>
  );
}
