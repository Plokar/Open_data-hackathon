'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { LocateFixed, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { gameApi, type Category, type PlaceFeature } from '@/lib/api';
import { CATEGORY, RARITY, distanceM, formatDistance } from '@/lib/game';
import { cn } from '@/lib/utils';

const PlacesMap = dynamic(() => import('@/components/map/PlacesMap'), { ssr: false });

export default function MapPage() {
  const { user } = useAuth();
  const [features, setFeatures] = useState<PlaceFeature[]>([]);
  const [stamped, setStamped] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<Set<Category>>(new Set());
  const [selected, setSelected] = useState<PlaceFeature | null>(null);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [centerTick, setCenterTick] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    gameApi.places().then((d) => setFeatures(d.features)).catch(() => setError('Nepodařilo se načíst místa.'));
  }, []);
  useEffect(() => {
    if (user) gameApi.myCheckins().then((c) => setStamped(new Set(c.map((x) => x.place.id)))).catch(() => {});
  }, [user]);

  const visible = useMemo(
    () => (filter.size ? features.filter((f) => filter.has(f.properties.category)) : features),
    [features, filter],
  );

  const toggle = (c: Category) =>
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const dist = selected && me ? distanceM(me[0], me[1], selected.geometry.coordinates[1], selected.geometry.coordinates[0]) : null;

  return (
    <AppShell fullBleed>
      <div className="relative h-[calc(100dvh-7.5rem)]">
        <PlacesMap features={visible} stamped={stamped} onSelect={setSelected} onLocate={(a, b) => setMe([a, b])} centerOnMe={centerTick} />

        <div className="absolute inset-x-0 top-0 z-[500] flex gap-2 overflow-x-auto p-2" role="group" aria-label="Filtr kategorií">
          {(Object.keys(CATEGORY) as Category[]).map((c) => (
            <button key={c} onClick={() => toggle(c)} aria-pressed={filter.has(c)}
              className={cn('shrink-0 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm',
                filter.has(c) ? 'border-transparent text-white' : 'border-border bg-background/95 text-foreground')}
              style={filter.has(c) ? { background: CATEGORY[c].color } : undefined}>
              {CATEGORY[c].icon} {CATEGORY[c].label}
            </button>
          ))}
        </div>

        <button onClick={() => setCenterTick((t) => t + 1)} disabled={!me} aria-label="Ukázat mou polohu"
          className="absolute bottom-4 right-4 z-[500] rounded-full bg-background p-3 shadow-lg disabled:opacity-50">
          <LocateFixed className="h-5 w-5" />
        </button>

        {error && <div className="absolute inset-x-4 top-14 z-[500] rounded-lg bg-destructive p-3 text-sm text-white">{error}</div>}

        {selected && (
          <div className="absolute inset-x-2 bottom-2 z-[600] rounded-2xl border border-border bg-background p-4 shadow-xl">
            <button onClick={() => setSelected(null)} className="absolute right-3 top-3 text-muted-foreground" aria-label="Zavřít">
              <X className="h-5 w-5" />
            </button>
            <div className="text-xs text-muted-foreground">
              {CATEGORY[selected.properties.category].icon} {selected.properties.subtype} · {selected.properties.okres}
            </div>
            <div className="mt-1 pr-6 text-lg font-bold leading-tight">{selected.properties.name}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={cn('rounded-full px-2 py-0.5 font-semibold', RARITY[selected.properties.rarity].className)}>
                {RARITY[selected.properties.rarity].label}
              </span>
              {stamped.has(selected.properties.id) && <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 font-semibold text-yellow-700 dark:text-yellow-300">✓ V Pasu</span>}
              {dist != null && <span className="text-muted-foreground">od tebe {formatDistance(dist)}</span>}
            </div>
            <Link href={`/place/${selected.properties.id}`}
              className="mt-3 block rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">
              Detail a razítko
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
