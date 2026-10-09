'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { LocateFixed, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Guide } from '@/components/guide/Guide';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { gameApi, type Category, type PlaceDetail, type PlaceFeature } from '@/lib/api';
import { PlaceAbout, PlacePhoto } from '@/components/place/PlacePhoto';
import { PetArt } from '@/components/pet/PetCard';
import { CATEGORY, RARITY, distanceM, formatDistance } from '@/lib/game';
import { cn } from '@/lib/utils';

const PlacesMap = dynamic(() => import('@/components/map/PlacesMap'), { ssr: false });
const TIP_KEY = 'zg-tip-map-seen';

export default function MapPage() {
  const { user } = useAuth();
  const [features, setFeatures] = useState<PlaceFeature[]>([]);
  const [stamped, setStamped] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<Set<Category>>(new Set());
  const [selected, setSelected] = useState<PlaceFeature | null>(null);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [centerTick, setCenterTick] = useState(0);
  const [error, setError] = useState('');
  const [tip, setTip] = useState(false);
  const [detail, setDetail] = useState<PlaceDetail | null>(null);

  // Fotka a popis až po klepnutí: geojson se 617 místy zůstává lehký
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    gameApi.place(selected.properties.id).then((d) => alive && setDetail(d)).catch(() => {});
    return () => { alive = false; setDetail(null); };
  }, [selected]);

  useEffect(() => {
    gameApi.places().then((d) => setFeatures(d.features)).catch(() => setError('Místa se nenačetla. Zkontroluj připojení a obnov stránku.'));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage až po hydrataci
    setTip(!localStorage.getItem(TIP_KEY));
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

  const closeTip = () => {
    localStorage.setItem(TIP_KEY, '1');
    setTip(false);
  };

  const dist = selected && me ? distanceM(me[0], me[1], selected.geometry.coordinates[1], selected.geometry.coordinates[0]) : null;
  const sel = selected && CATEGORY[selected.properties.category];

  return (
    <AppShell fullBleed>
      <div className="relative h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))]">
        <PlacesMap features={visible} stamped={stamped} onSelect={(f) => { setSelected(f); closeTip(); }} onLocate={(a, b) => setMe([a, b])} centerOnMe={centerTick} />

        <div className="absolute inset-x-0 top-0 z-[500] flex gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:none]" role="group" aria-label="Filtr kategorií">
          {(Object.keys(CATEGORY) as Category[]).map((c) => {
            const { Icon, label, color } = CATEGORY[c];
            const on = filter.has(c);
            return (
              <button key={c} onClick={() => toggle(c)} aria-pressed={on}
                className={cn('flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border pl-3 pr-4 text-sm font-semibold shadow-[0_2px_8px_-2px_rgb(28_43_34/0.25)]',
                  on ? 'border-transparent text-white' : 'border-border bg-card text-foreground')}
                style={on ? { background: color } : undefined}>
                <Icon className="h-4 w-4" style={on ? undefined : { color }} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>

        <button onClick={() => setCenterTick((t) => t + 1)} disabled={!me} aria-label="Ukázat mou polohu"
          className="absolute bottom-4 right-4 z-[500] grid h-12 w-12 cursor-pointer place-items-center rounded-full border border-border bg-card shadow-[0_4px_12px_-4px_rgb(28_43_34/0.35)] disabled:opacity-50">
          <LocateFixed className="h-5 w-5" />
        </button>

        {error && <div role="alert" className="absolute inset-x-3 top-16 z-[500] rounded-xl bg-destructive p-3 text-sm font-medium text-destructive-foreground">{error}</div>}

        {tip && !selected && features.length > 0 && (
          <div className="absolute inset-x-3 bottom-20 z-[600]">
            <Guide who="kukadlo" action={<Button size="sm" onClick={closeTip}>Rozumím</Button>}>
              Tady je {features.length} míst. Klepni na kterékoli a uvidíš, jak je daleko. Se žlutým okrajem už máš v Pasu.
            </Guide>
          </div>
        )}

        {selected && sel && (
          <div className="absolute inset-x-0 bottom-0 z-[600] max-h-[78%] overflow-y-auto rounded-t-3xl border-t border-border bg-card px-5 pb-5 pt-3 shadow-[0_-8px_24px_-12px_rgb(28_43_34/0.4)]" role="dialog" aria-label={selected.properties.name}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-input" aria-hidden />
            <button onClick={() => setSelected(null)} className="absolute right-2 top-2 z-10 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-card/90 text-muted-foreground hover:bg-accent" aria-label="Zavřít">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 pr-10 text-sm text-muted-foreground">
              <sel.Icon className="h-4 w-4 shrink-0" style={{ color: sel.color }} aria-hidden />
              <span className="truncate">{selected.properties.subtype || sel.label}{selected.properties.okres && `, okres ${selected.properties.okres}`}</span>
            </div>
            <h2 className="mt-1 pr-8 text-xl font-bold leading-tight">{selected.properties.name}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className={cn('rounded-full px-2.5 py-0.5 font-semibold', RARITY[selected.properties.rarity].className)}>
                {RARITY[selected.properties.rarity].label}
              </span>
              {stamped.has(selected.properties.id) && <span className="rounded-full bg-trail-yellow/30 px-2.5 py-0.5 font-semibold">V Pasu</span>}
              {dist != null && <span className="text-muted-foreground">{formatDistance(dist)} od tebe</span>}
            </div>
            {detail?.id === selected.properties.id && (
              <>
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-muted px-3 py-2 text-sm">
                  {detail.my_pet && <PetArt type={detail.my_pet.type} seed={detail.my_pet.seed} stage={detail.my_pet.stage} rarity={detail.my_pet.rarity} size={44} />}
                  <span>
                    {detail.my_pet ? <>Odsud máš <b>{detail.my_pet.name}</b>. </> : null}
                    {detail.stamp_count === 0 ? 'Zatím tu nikdo nezískal tvora.' : `Tvorů odsud celkem: ${detail.stamp_count}.`}
                  </span>
                </div>
                <PlacePhoto place={detail} className="mt-4" />
                <div className="mt-3 text-[15px]"><PlaceAbout place={detail} clamp /></div>
              </>
            )}
            <Link href={`/place/${selected.properties.id}`}
              className="mt-4 flex h-13 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-[0_2px_0_0_rgb(0_0_0/0.18)]">
              {stamped.has(selected.properties.id) ? 'Ukázat místo' : 'Ukázat místo a razítko'}
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
