'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, Bus, Camera, Croissant, ExternalLink, MapPin, Stamp } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PetArt, PetCard } from '@/components/pet/PetCard';
import { Button } from '@/components/ui/button';
import { Guide } from '@/components/guide/Guide';
import { PlaceAbout, PlacePhoto } from '@/components/place/PlacePhoto';
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
      setPlace({ ...place, stamped: true, stamp_count: place.stamp_count + 1, my_pet: r.pet });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!place) return <AppShell><p className="text-muted-foreground">{error || 'Načítám místo…'}</p></AppShell>;
  const cat = CATEGORY[place.category];

  return (
    <AppShell>
      <PlacePhoto place={place} className="-mx-4 -mt-5 mb-5 rounded-none rounded-b-3xl" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <cat.Icon className="h-4 w-4 shrink-0" style={{ color: cat.color }} aria-hidden />
        <span>{place.subtype || cat.label}{place.obec && `, ${place.obec}`}</span>
      </div>
      <h1 className="mt-1 text-3xl font-extrabold leading-tight">{place.name}</h1>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <span className={cn('rounded-full px-2.5 py-0.5 font-semibold', RARITY[place.rarity].className)}>{RARITY[place.rarity].label}</span>
        <span className="rounded-full bg-muted px-2.5 py-0.5">{place.stamp_count === 0 ? 'Zatím tu nikdo nezískal tvora' : `Tvorů odsud: ${place.stamp_count}`}</span>
        {place.stamped && <span className="rounded-full bg-trail-yellow/30 px-2.5 py-0.5 font-semibold">V Pasu</span>}
      </div>

      {place.is_hazardous && (
        <div className="mt-4 flex gap-3 rounded-2xl bg-trail-yellow/20 p-4 text-sm leading-relaxed">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#8a6410] dark:text-trail-yellow" aria-hidden />
          <span>Nevstupuj do uzavřených prostor, štol ani na nezabezpečené zříceniny. Razítko platí z veřejně přístupného místa do 300 m.</span>
        </div>
      )}

      <div className="mt-4"><PlaceAbout place={place} /></div>

      {!!place.extra.products?.length && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold"><Croissant className="h-4 w-4" style={{ color: cat.color }} aria-hidden />Oceněné Dobroty Karlovarského kraje</div>
          <ul className="mt-1 list-disc pl-5">
            {place.extra.products.map((p, i) => <li key={i}>{p.name} <span className="text-muted-foreground">({p.category}, {p.year})</span></li>)}
          </ul>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {place.nearest_stop_name && (
          <div className="flex items-center gap-3"><Bus className="h-5 w-5 shrink-0 text-trail-blue" aria-hidden /><span>Autobus staví na zastávce <b>{place.nearest_stop_name}</b>, {formatDistance(place.nearest_stop_m)} odsud</span></div>
        )}
        <a className="flex items-center gap-3 font-semibold text-primary underline" target="_blank" rel="noreferrer"
          href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=16/${place.lat}/${place.lon}`}>
          <MapPin className="h-5 w-5" aria-hidden /> Navigovat v mapě
        </a>
        {place.url && <a className="flex items-center gap-3 font-semibold text-primary underline" href={place.url} target="_blank" rel="noreferrer"><ExternalLink className="h-5 w-5" aria-hidden /> Web místa</a>}
      </div>

      <div className="mt-8">
        {!user ? (
          <Link href="/start" className="flex h-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">Založ si Pas a získej razítko</Link>
        ) : place.stamped ? (
          place.my_pet ? (
            <Link href="/pets" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <PetArt type={place.my_pet.type} seed={place.my_pet.seed} stage={place.my_pet.stage} rarity={place.my_pet.rarity} size={72} />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Tvůj tvor z tohoto místa</div>
                <div className="truncate text-lg font-bold">{place.my_pet.name}</div>
                <div className="text-sm text-muted-foreground">lvl {place.my_pet.level}, razítko máš v Pasu</div>
              </div>
            </Link>
          ) : <Guide who="boza">Tohle razítko už v Pasu máš. Na mapě čekají další místa.</Guide>
        ) : (
          <>
            <p className="mb-3 text-center text-sm text-muted-foreground">Vyfoť místo, ne lidi. Poloha se ověří, musíš být blíž než 300 m.</p>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
            <Button size="lg" className="h-16 w-full rounded-2xl text-lg" isLoading={busy} onClick={() => pick(false)} aria-label="Vyfotit místo a získat razítko">
              <Camera className="h-6 w-6" /> Vyfotit a orazítkovat
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

      <p className="mt-8 text-xs text-muted-foreground">
        Zdroj: <a className="underline" href={place.source_url} target="_blank" rel="noreferrer">DATA ZÁPAD</a>, licence {place.license}.
      </p>

      {result && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal aria-label="Získal jsi razítko">
          <div className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-3xl bg-background p-4">
            <div className="flex items-center justify-center gap-3">
              <div className="stamp-down grid h-16 w-16 place-items-center rounded-full border-[2.5px] border-trail-red text-trail-red"><Stamp className="h-7 w-7" aria-hidden /></div>
              <div>
                <div className="text-xl font-extrabold">Razítko je tvoje</div>
                <div className="text-sm text-muted-foreground">+{result.xp_gain} XP{result.level_up && `, nová úroveň ${result.level}`}</div>
              </div>
            </div>
            <div className="mb-2 mt-4 font-hand text-xl text-primary">A tady je tvůj nový tvor:</div>
            <PetCard pet={result.pet} />
            {result.new_badges.length > 0 && (
              <div className="mt-3 rounded-2xl bg-trail-yellow/25 p-3 text-center text-sm font-semibold">
                Nový odznak: {result.new_badges.map((b) => `${b.icon} ${b.name}`).join(', ')}
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/pets" className="flex h-12 items-center justify-center rounded-xl bg-muted font-semibold">Moji tvorové</Link>
              <Link href="/map" className="flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground">Další místo</Link>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
