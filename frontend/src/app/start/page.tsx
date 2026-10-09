'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Landscape } from '@/components/brand/Landscape';
import { TrailMark, type TrailColor } from '@/components/brand/TrailMark';
import { GUIDES, GuideAvatar, MascotArt, type GuideId } from '@/components/guide/Guide';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError, type PetType } from '@/lib/api';
import { CATEGORY, PET_TYPE } from '@/lib/game';
import { cn } from '@/lib/utils';

const TRAIL: TrailColor[] = ['blue', 'red', 'green', 'yellow'];

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative grid aspect-[5/4] w-full place-items-center overflow-hidden rounded-3xl border border-border bg-card', className)}>
      {children}
    </div>
  );
}

/** Stránka Pasu se starším razítkem a čerstvým, které právě dopadlo. */
function StampPreview() {
  return (
    <Panel className="bg-[repeating-linear-gradient(transparent_0_27px,var(--border)_27px_28px)]">
      <div className="absolute left-6 top-6 grid h-24 w-24 rotate-12 place-items-center rounded-full border-2 border-trail-blue/50 text-center text-trail-blue/60">
        <div>
          <CATEGORY.lookout.Icon className="mx-auto h-5 w-5" aria-hidden />
          <div className="text-[10px] font-extrabold uppercase leading-tight">Rozhledna<br />Háj</div>
        </div>
      </div>
      <div className="stamp-down grid h-44 w-44 place-items-center rounded-full border-[3px] border-trail-red bg-card/40 text-center text-trail-red" style={{ transform: 'rotate(-8deg)' }}>
        <div className="grid h-[150px] w-[150px] place-items-center rounded-full border border-dashed border-trail-red/70">
          <div>
            <CATEGORY.castle.Icon className="mx-auto h-8 w-8" aria-hidden />
            <div className="mt-1 text-base font-extrabold uppercase leading-none tracking-wide">Hrad Loket</div>
            <div className="font-hand text-xl leading-tight">{new Date().toLocaleDateString('cs-CZ')}</div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** Typy se přebíjí v kruhu (pořadí jako v pravidlech souboje), šipky ukazují, kdo koho. */
function TypeCycle() {
  const order: PetType[] = ['fortress', 'view', 'nature', 'spring', 'culture'];
  return (
    <Panel>
      {/* elipsa s poloměrem 36 % panelu, tvorové sedí přesně na ní */}
      <div className="absolute inset-[14%] rounded-[50%] border-2 border-dotted border-trail-red/50" aria-hidden />
      <p className="max-w-[9rem] text-center font-hand text-xl leading-tight text-muted-foreground">každý přebíjí toho, kdo jde po něm</p>
      {order.map((t, i) => {
        const a = (i / order.length) * 2 * Math.PI - Math.PI / 2;
        return (
          <figure key={t} className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ left: `${50 + 36 * Math.cos(a)}%`, top: `${50 + 36 * Math.sin(a)}%` }}>
            <MascotArt type={t} seed={(i + 3) * 191919191} size={58} />
            <figcaption className="-mt-1 text-xs font-semibold">{PET_TYPE[t].label}</figcaption>
          </figure>
        );
      })}
    </Panel>
  );
}

function PlacePreview() {
  return (
    <Panel className="place-items-start">
      <Landscape className="absolute inset-x-0 bottom-0 h-[78%] w-full" />
      <ul className="relative flex flex-wrap gap-2 p-4">
        {(['castle', 'lookout', 'spring', 'food'] as const).map((c) => {
          const { Icon, label, color } = CATEGORY[c];
          return (
            <li key={c} className="flex h-10 items-center gap-2 rounded-full border border-border bg-card pl-3 pr-4 text-sm font-semibold shadow-[0_2px_8px_-3px_rgb(28_43_34/0.3)]">
              <Icon className="h-4 w-4" style={{ color }} aria-hidden />{label}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

const STEPS: { who: GuideId; text: string; preview: React.ReactNode }[] = [
  {
    who: 'kukadlo',
    text: 'Ahoj, já jsem Kukadlo. Z rozhledny vidím celý kraj, tak ti na mapě ukážu, kam se vyplatí vyrazit. Hrady, vyhlídky, prameny i místní dobroty.',
    preview: <PlacePreview />,
  },
  {
    who: 'boza',
    text: 'Já jsem Bóža a hlídám razítka. Až budeš u místa blíž než 300 metrů, vyfoť ho a razítko je tvoje. Za celé okresy pak dostaneš odznaky.',
    preview: <StampPreview />,
  },
  {
    who: 'vridla',
    text: 'A já Vřídla. Z každého razítka ti vylíhnu tvora podle toho, kde vznikl. Každý typ jednoho přebíjí, tak si pak vyber dobře, koho pošleš na kamarády.',
    preview: <TypeCycle />,
  },
];

/** Přezdívka z jména: mezery na podtržítka, jen písmena, čísla a . _ - (stejně jako backend). */
function nicknameFrom(name: string) {
  const n = name.normalize('NFC').trim().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}._-]/gu, '').slice(0, 26);
  return n.length >= 3 ? n : `${n}_hrac`.replace(/^_/, '');
}

function randomToken(len = 20) {
  // getRandomValues funguje i na http (telefon v LAN), randomUUID ne
  const a = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(a, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}

/** Kam po založení Pasu: zpět na pozvánku (?redirect=/battle/…), jinak na mapu. Jen interní cesty. */
function afterStart() {
  const r = new URLSearchParams(window.location.search).get('redirect');
  return r && r.startsWith('/') && !r.startsWith('//') ? r : '/map';
}

export default function StartPage() {
  const router = useRouter();
  const { register, user } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const last = STEPS.length; // poslední krok je jméno

  useEffect(() => {
    if (user && !busy) router.replace(afterStart());
  }, [user, busy, router]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) return setError('Napiš aspoň dvě písmena.');
    setError('');
    setBusy(true);
    // ponytail: pro demo stačí jméno, e-mail a heslo generujeme; přihlášení drží JWT cookie
    const id = randomToken(6);
    const password = randomToken();
    const base = nicknameFrom(clean);
    try {
      for (let attempt = 0; ; attempt++) {
        const nickname = attempt ? `${base.slice(0, 27)}${Math.floor(10 + Math.random() * 90)}` : base;
        try {
          await register({
            username: `${nickname}_${id}`, nickname, first_name: clean.slice(0, 150),
            email: `hrac-${id}@zapadgo.cz`, password, password2: password,
            age_group: 'under18', consent_confirmed: true,
          });
          break;
        } catch (err) {
          const taken = err instanceof ApiError && !!(err.data as Record<string, unknown> | undefined)?.nickname;
          if (!taken || attempt >= 4) throw err;
        }
      }
      router.replace(afterStart());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pas se nepodařilo založit. Zkus to znovu.');
      setBusy(false);
    }
  };

  const s = STEPS[step];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
      <header className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={last + 1} aria-valuenow={step + 1} aria-label={`Krok ${step + 1} ze ${last + 1}`}>
          {TRAIL.map((c, i) => (
            <TrailMark key={c} color={c} className={cn('h-4 transition-opacity', i > step && 'opacity-30')} />
          ))}
        </div>
        {step < last && (
          <button onClick={() => setStep(last)} className="h-11 cursor-pointer rounded-full px-4 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
            Přeskočit
          </button>
        )}
      </header>

      {s ? (
        <main key={step} className="step-in flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center py-4">
            {s.preview}
          </div>
          <div className="flex items-end gap-3">
            <GuideAvatar who={s.who} size={108} className="-mb-2 shrink-0" />
            <div className="relative mb-6 flex-1 rounded-3xl rounded-bl-md border border-border bg-card p-4 shadow-[0_10px_24px_-14px_rgb(28_43_34/0.45)]">
              <p className="font-hand text-2xl leading-none text-primary">{GUIDES[s.who].name}</p>
              <p className="mt-2 text-[16px] leading-snug">{s.text}</p>
            </div>
          </div>
        </main>
      ) : (
        <main key="name" className="step-in flex flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-center py-6">
            <div className="flex items-end justify-center -space-x-3">
              <GuideAvatar who="boza" size={76} />
              <GuideAvatar who="vridla" size={92} className="relative z-10" />
              <GuideAvatar who="kukadlo" size={76} />
            </div>
            <form onSubmit={create} className="mt-6" noValidate>
              <label htmlFor="name" className="block text-[1.9rem] font-extrabold leading-tight tracking-tight">Jak ti máme říkat?</label>
              <p className="mt-1 text-muted-foreground">Jméno uvidí ostatní v žebříčku. Nic víc nepotřebujeme.</p>
              <Input id="name" className="mt-5 h-14 text-lg" value={name} onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="Třeba Bára" maxLength={30} autoComplete="given-name" autoFocus enterKeyHint="go"
                aria-invalid={!!error} aria-describedby={error ? 'name-error' : undefined} />
              {error && <p id="name-error" role="alert" className="mt-2 text-sm font-medium text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="mt-4 h-14 w-full text-lg" isLoading={busy}>Založit Pas</Button>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Založením souhlasíš, že při razítkování použijeme tvou polohu a fotku místa.
                Fotky vidíš jen ty. <Link href="/privacy" className="underline">Zásady soukromí</Link>
              </p>
            </form>
          </div>
        </main>
      )}

      <nav className="flex items-center gap-3 pt-2">
        {step > 0 && (
          <Button variant="ghost" size="icon" className="h-14 w-14 shrink-0" onClick={() => setStep(step - 1)} aria-label="Zpět">
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        {step < last && (
          <Button size="lg" className="h-14 flex-1 text-lg" onClick={() => setStep(step + 1)}>
            {step === last - 1 ? 'Jdeme na to' : 'Dál'}
          </Button>
        )}
      </nav>
      {step === 0 && (
        <p className="mt-3 text-center text-sm text-muted-foreground">Už máš Pas? <Link href="/login" onClick={(e) => { e.preventDefault(); router.push(`/login${window.location.search}`); }} className="font-semibold text-primary underline">Přihlas se</Link></p>
      )}
    </div>
  );
}
