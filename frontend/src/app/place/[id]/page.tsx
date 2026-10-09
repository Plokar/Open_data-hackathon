'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, Bus, Camera, ExternalLink, MapPin } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PetCard } from '@/components/pet/PetCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage, gameApi, type CheckInResult, type PlaceDetail } from '@/lib/api';
import { CATEGORY, RARITY, formatDistance } from '@/lib/game';
import { cn } from '@/lib/utils';

/** Zmenší fotku na max. 1600 px (rychlost na mobilu). Když to prohlížeč neumí, pošle originál. */
async function resize(file: File, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s);
    c.height = Math.round(bmp.height * s);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej()), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}

function position(): Promise<GeolocationPosition> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Prohlížeč neumí zjistit polohu.'));
    navigator.geolocation.getCurrentPosition(res, () => rej(new Error('Povol přístup k poloze (a použij HTTPS).')), {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 0,
    });
  });
}

export default function PlacePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const demo = useRef(false);

  useEffect(() => {
    gameApi.place(id).then(setPlace).catch(() => setError('Místo nenalezeno.'));
  }, [id, user]);

  const pick = (isDemo: boolean) => {
    demo.current = isDemo;
    setError('');
    fileRef.current?.click();
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !place) return;
    setBusy(true);
    try {
      const [pos, photo] = await Promise.all([position(), resize(file)]);
      const form = new FormData();
      form.append('place', String(place.id));
      form.append('lat', String(pos.coords.latitude));
      form.append('lon', String(pos.coords.longitude));
      form.append('accuracy', String(pos.coords.accuracy));
      form.append('client_ts', String(Date.now()));
      form.append('photo', photo, 'misto.jpg');
      if (demo.current) form.append('demo', '1');
      const r = await gameApi.checkIn(form);
      setResult(r);
      setPlace({ ...place, stamped: true, stamp_count: place.stamp_count + 1 });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!place) return <AppShell><p className="text-sm text-muted-foreground">{error || 'Načítám…'}</p></AppShell>;
  const cat = CATEGORY[place.category];

  return (
    <AppShell>
      <div className="text-xs text-muted-foreground">{cat.icon} {place.subtype} · {place.obec}, okres {place.okres}</div>
      <h1 className="mt-1 text-2xl font-extrabold leading-tight">{place.name}</h1>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className={cn('rounded-full px-2 py-0.5 font-semibold', RARITY[place.rarity].className)}>{RARITY[place.rarity].label}</span>
        <span className="rounded-full bg-muted px-2 py-0.5">Razítek od hráčů: {place.stamp_count}</span>
        {place.stamped && <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 font-semibold text-yellow-700 dark:text-yellow-300">✓ V Pasu</span>}
      </div>

      {place.is_hazardous && (
        <div className="mt-3 flex gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500" />
          <span>Nevstupuj do uzavřených prostor, štol ani na nezabezpečené zříceniny. Razítko platí z veřejně přístupného místa do 300 m.</span>
        </div>
      )}

      {place.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{place.description}</p>}

      {!!place.extra.products?.length && (
        <div className="mt-3 rounded-xl bg-pink-500/10 p-3 text-sm">
          <div className="font-semibold">🥨 Oceněné Dobroty Karlovarského kraje</div>
          <ul className="mt-1 list-disc pl-5">
            {place.extra.products.map((p, i) => <li key={i}>{p.name} <span className="text-muted-foreground">({p.category}, {p.year})</span></li>)}
          </ul>
        </div>
      )}

      <div className="mt-3 space-y-1 text-sm">
        {place.nearest_stop_name && (
          <div className="flex items-center gap-2"><Bus className="h-4 w-4 text-muted-foreground" /> Nejbližší zastávka: <b>{place.nearest_stop_name}</b> ({formatDistance(place.nearest_stop_m)})</div>
        )}
        <a className="flex items-center gap-2 text-primary underline" target="_blank" rel="noreferrer"
          href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=16/${place.lat}/${place.lon}`}>
          <MapPin className="h-4 w-4" /> Otevřít v mapě
        </a>
        {place.url && <a className="flex items-center gap-2 text-primary underline" href={place.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Web místa</a>}
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-4">
        {!user ? (
          <Link href={`/login?redirect=/place/${place.id}`} className="block rounded-xl bg-primary py-3 text-center font-semibold text-primary-foreground">Přihlas se a získej razítko</Link>
        ) : place.stamped ? (
          <p className="text-center text-sm">Tohle místo už máš v Pasu. 🎉</p>
        ) : (
          <>
            <p className="mb-3 text-center text-xs text-muted-foreground">📷 Nefoť lidi, foť místo. Poloha se ověřuje na serveru (do 300 m).</p>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
            <Button size="lg" className="w-full" isLoading={busy} onClick={() => pick(false)} aria-label="Vyfotit místo a získat razítko">
              <Camera className="h-5 w-5" /> Razítkovat
            </Button>
            {user.is_staff && (
              <Button variant="outline" className="mt-2 w-full" disabled={busy} onClick={() => pick(true)}>
                Demo razítko (bez kontroly vzdálenosti)
              </Button>
            )}
          </>
        )}
        {error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-2 text-center text-sm text-destructive">{error}</p>}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Zdroj: <a className="underline" href={place.source_url} target="_blank" rel="noreferrer">DATA ZÁPAD</a>, licence {place.license}.
      </p>

      {result && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal aria-label="Získal jsi razítko">
          <div className="w-full max-w-sm animate-in zoom-in-95 rounded-3xl bg-background p-4">
            <div className="text-center text-sm font-semibold text-primary">Razítko získáno! +{result.xp_gain} XP{result.level_up && ` · Level ${result.level}!`}</div>
            <div className="mb-2 text-center text-xs text-muted-foreground">Z místa se zrodil nový PET:</div>
            <PetCard pet={result.pet} />
            {result.new_badges.length > 0 && (
              <div className="mt-3 rounded-xl bg-yellow-400/15 p-3 text-center text-sm">
                Nový odznak: {result.new_badges.map((b) => `${b.icon} ${b.name}`).join(', ')}
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/pets" className="rounded-xl bg-muted py-2.5 text-center text-sm font-semibold">Moji PETi</Link>
              <Link href="/map" className="rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">Další místo</Link>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
