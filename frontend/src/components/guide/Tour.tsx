'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { TrailMark, type TrailColor } from '@/components/brand/TrailMark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { GUIDES, GuideAvatar, type GuideId } from './Guide';

/** Nastaví se po založení Pasu (/start), prohlídka ho po dokončení nebo přeskočení smaže. */
export const TOUR_KEY = 'zg-tour';

type Step = { who: GuideId; trail: TrailColor; target?: string; text: (name: string) => React.ReactNode };

// Cíle jsou prvky AppShellu, které jsou na každé stránce. Chybí-li cíl (terč je jen na mapě), bublina je uprostřed.
const STEPS: Step[] = [
  { who: 'kukadlo', trail: 'red', text: (n) => <>Ahoj {n}! Jsem Kukadlo. Za chvilku ti s Bóžou a Vřídlou ukážeme, co tu najdeš.</> },
  { who: 'kukadlo', trail: 'blue', target: 'nav a[href="/map"]', text: () => <>Na <b>Mapě</b> jsou stovky míst z celého Karlovarského kraje. Klepni na kterékoli a uvidíš, jak je daleko.</> },
  { who: 'kukadlo', trail: 'blue', target: '[aria-label="Ukázat mou polohu"]', text: () => <>Terčem skočíš na svou polohu. Čárkovaný kruh kolem tebe je <b>dosah 300 metrů</b>, místa v něm můžeš orazítkovat.</> },
  { who: 'boza', trail: 'red', target: 'nav a[href="/pass"]', text: () => <>U místa vyfoť, co vidíš, a dostaneš <b>razítko do Pasu</b>. Za sbírky razítek jsou odznaky.</> },
  { who: 'vridla', trail: 'green', target: 'nav a[href="/pets"]', text: () => <>Z každého razítka se vylíhne <b>tvor</b>. Roste se zkušenostmi, na 3. levelu se vyvine a dva tvory můžeš spojit v nového.</> },
  { who: 'boza', trail: 'yellow', target: 'nav a[href="/battle"]', text: () => <>Tvory pošli do <b>souboje</b> s kamarády. Na mapě navíc číhají bossové s korunkou.</> },
  { who: 'kukadlo', trail: 'blue', target: 'nav a[href="/leaderboard"]', text: () => <>V <b>Žebříčku</b> uvidíš, kdo prošel kraj nejvíc. Třeba tam brzy budeš ty.</> },
  { who: 'boza', trail: 'red', target: 'header a[href^="/u/"]', text: () => <>Tohle je tvůj profil. Přidej si v něm <b>e-mail a heslo</b>, ať o Pas nepřijdeš, až změníš telefon.</> },
  { who: 'vridla', trail: 'green', text: () => <>To je všechno. Vyraž na první razítko, budeme u toho s tebou!</> },
];
const PAD = 6;

/** Prohlídka aplikace s průvodci po prvním přihlášení: ztmaví obrazovku a postupně zvýrazní části navigace. */
export function Tour() {
  const { user } = useAuth();
  const authed = !!user;
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const s = step === null ? null : STEPS[step];
  const last = step === STEPS.length - 1;

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage až po hydrataci
      if (authed && localStorage.getItem(TOUR_KEY)) setStep(0);
    } catch { /* bez úložiště prohlídka není */ }
  }, [authed]);

  const close = useCallback(() => {
    try { localStorage.removeItem(TOUR_KEY); } catch { /* nic */ }
    setStep(null);
  }, []);
  const go = useCallback((d: number) => setStep((i) => (i === null ? null : Math.min(STEPS.length - 1, Math.max(0, i + d)))), []);
  const advance = useCallback(() => (last ? close() : go(1)), [last, close, go]);

  // Zvýraznění sleduje cíl i po otočení telefonu
  useLayoutEffect(() => {
    if (!s) return;
    const measure = () => setRect((s.target && document.querySelector(s.target)?.getBoundingClientRect()) || null);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [s]);

  useEffect(() => {
    if (step === null) return;
    nextBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') advance();
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, close, advance, go]);

  if (!s || !user || step === null) return null;
  const vh = window.innerHeight;
  // Cíl v horní půlce (profil) → bublina pod ním, dole (navigace, terč) → nad ním
  const place: React.CSSProperties = !rect ? { top: '50%', transform: 'translateY(-50%)' }
    : rect.top + rect.height / 2 < vh / 2 ? { top: rect.bottom + PAD + 14 } : { bottom: vh - rect.top + PAD + 14 };

  return (
    <div className="fixed inset-0 z-[4000]" role="dialog" aria-modal aria-label="Prohlídka aplikace">
      {/* Díra ve ztmavení; klepnutí na zvýrazněné místo posune prohlídku dál */}
      <button type="button" tabIndex={-1} aria-hidden onClick={advance}
        className={cn('tour-spot absolute cursor-pointer rounded-2xl', rect && 'tour-ring')}
        style={rect ? { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD }
          : { left: '50%', top: '50%', width: 0, height: 0 }} />

      <div className="absolute inset-x-0 mx-auto flex max-w-md items-end gap-2 px-3" style={place}>
        <GuideAvatar key={s.who} who={s.who} size={84} className="hop-in -mb-1" />
        <div key={step} className="step-in min-w-0 flex-1 rounded-3xl rounded-bl-md border border-border bg-card p-4 shadow-[0_14px_30px_-12px_rgb(0_0_0/0.5)]">
          <div className="flex items-center justify-between gap-2">
            <p className="font-hand text-2xl leading-none text-primary">{GUIDES[s.who].name}</p>
            <div className="flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={`Krok ${step + 1} z ${STEPS.length}`}>
              {STEPS.map((x, i) => <TrailMark key={i} color={x.trail} className={cn('h-2.5 transition-opacity', i > step && 'opacity-25')} />)}
            </div>
          </div>
          <p className="mt-2 text-[16px] leading-snug" aria-live="polite">{s.text(user.first_name || user.profile.nickname)}</p>
          <div className="mt-4 flex items-center gap-1">
            {!last && (
              <button type="button" onClick={close} className="h-11 cursor-pointer rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
                Přeskočit
              </button>
            )}
            <span className="flex-1" />
            {step > 0 && (
              <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => go(-1)} aria-label="Zpět">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <Button ref={nextBtn} className="h-11 px-6" onClick={advance}>{last ? 'Vyrazit' : step === 0 ? 'Ukaž mi to' : 'Dál'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
