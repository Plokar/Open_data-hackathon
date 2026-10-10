'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { MergeResult, Pet, Rarity } from '@/lib/api';
import { RARITY } from '@/lib/game';
import { ELEMENT_GLOW } from '@/lib/petArt';
import { PetArt, PetCard } from './PetCard';

// Čím vzácnější výsledek, tím barevnější a bohatší výbuch
const RARITY_FX: Record<Rarity, { color: string; sparks: number; flashes: number }> = {
  common: { color: '#e2e8f0', sparks: 14, flashes: 1 },
  rare: { color: '#60a5fa', sparks: 22, flashes: 1 },
  epic: { color: '#c084fc', sparks: 32, flashes: 2 },
  legendary: { color: '#facc15', sparks: 44, flashes: 3 },
};
const STAT_LABEL: Record<string, string> = { hp: 'Život', atk: 'Útok', defense: 'Obrana', spd: 'Rychlost', mag: 'Magie', stamina: 'Výdrž' };

/**
 * Šlechtění: dva tvorové kolem sebe krouží, splynou do světla a podle výsledku z API se vyklube nový tvor
 * (efekty podle rarity), nebo se odrazí a zahalí kouřem. Animace běží hned, výsledek se dočká.
 */
export function MergeScene({ a, b, result, error, onClose }: { a: Pet; b: Pet; result: MergeResult | null; error: string; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  // Scéna se otevírá až po kliknutí, window tu vždy je. Při omezeném pohybu rovnou výsledek.
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [converged, setConverged] = useState(reduced);
  const [animDone, setDone] = useState(false);
  const done = animDone || (reduced && !!(result || error));
  const rarity: Rarity = result?.pet?.rarity ?? 'common';
  const fx = RARITY_FX[rarity];

  // 1) přiblížení po spirále, energie mezi tvory
  useEffect(() => {
    const q = gsap.utils.selector(root);
    if (reduced) return;
    const orbit = { t: 0 };
    const place = () => {
      const r = 120 * (1 - orbit.t * 0.92), ang = orbit.t * Math.PI * 3;
      gsap.set(q('.m-a'), { x: -Math.cos(ang) * r, y: Math.sin(ang) * r * 0.45, rotate: orbit.t * 360 });
      gsap.set(q('.m-b'), { x: Math.cos(ang) * r, y: -Math.sin(ang) * r * 0.45, rotate: -orbit.t * 360 });
    };
    place();
    const tl = gsap.timeline({ onComplete: () => setConverged(true) });
    tl.fromTo(q('.m-a, .m-b'), { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.1 })
      .to(orbit, { t: 1, duration: 2.2, ease: 'power2.in', onUpdate: place }, '+=0.2')
      // výchozí filtr explicitně: z „none“ by GSAP interpoloval přes brightness(0) a tvorové by zčernali
      .fromTo(q('.m-a, .m-b'), { filter: 'brightness(1) drop-shadow(0 0 0px #fff)' },
        { scale: 0.55, filter: 'brightness(2.2) drop-shadow(0 0 22px #fff)', duration: 2.2, ease: 'power2.in' }, '<')
      .to(q('.m-core'), { scale: 1.6, opacity: 1, duration: 2.2, ease: 'power2.in' }, '<');
    q('.m-spark').forEach((s) => gsap.fromTo(s,
      { x: gsap.utils.random(-180, 180), y: gsap.utils.random(-140, 140), opacity: 0 },
      { x: 0, y: 0, opacity: 1, duration: gsap.utils.random(0.8, 1.6), repeat: -1, delay: gsap.utils.random(0, 1.5), ease: 'power2.in' }));
    return () => { tl.kill(); gsap.killTweensOf(q('.m-spark')); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- choreografie běží jednou
  }, []);

  // 2) výsledek: nový tvor (podle rarity) nebo neúspěch
  useEffect(() => {
    if (!converged || (!result && !error)) return;
    const q = gsap.utils.selector(root);
    gsap.killTweensOf(q('.m-spark'));
    if (reduced) {
      gsap.set(q('.m-a, .m-b, .m-core'), { opacity: result?.success ? 0 : 1, scale: 1, x: (i: number) => (i ? 70 : -70), y: 0, rotate: 0, filter: 'none' });
      gsap.set(q('.m-child, .m-rays, .m-text'), { opacity: 1 });
      return;
    }
    const tl = gsap.timeline({ onComplete: () => setDone(true) });
    if (result?.success) {
      for (let i = 0; i < fx.flashes; i++) tl.to(q('.m-flash'), { opacity: 1, duration: 0.12 }).to(q('.m-flash'), { opacity: i === fx.flashes - 1 ? 0 : 0.3, duration: 0.25 });
      tl.set(q('.m-a, .m-b, .m-core, .m-spark'), { opacity: 0 }, fx.flashes * 0.12)
        .fromTo(q('.m-ring'), { scale: 0.2, opacity: 1 }, { scale: 4, opacity: 0, duration: 0.9, ease: 'power2.out' }, '<')
        .fromTo(q('.m-child'), { scale: 0.2, opacity: 0, rotate: -20 }, { scale: 1, opacity: 1, rotate: 0, duration: 1.2, ease: 'elastic.out(1, 0.45)' }, '<')
        .to(q('.m-rays'), { opacity: 1, duration: 0.6 }, '<')
        .fromTo(q('.m-confetti'), { x: 0, y: 0, opacity: 1, scale: 1 },
          { x: () => gsap.utils.random(-220, 220), y: () => gsap.utils.random(-260, 120), rotate: () => gsap.utils.random(-360, 360), opacity: 0, scale: 0.4, duration: 1.6, ease: 'power3.out', stagger: 0.01 }, '<')
        .fromTo(q('.m-text'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '<0.5');
      gsap.to(q('.m-rays'), { rotate: 360, duration: rarity === 'legendary' ? 10 : 18, repeat: -1, ease: 'none' });
    } else if (result?.lost) {
      // ztráta: tvorové se rozpadnou v kouři a zmizí
      tl.to(q('.m-core'), { scale: 3, opacity: 0, duration: 0.35 })
        .to(q('.m-a, .m-b'), { scale: 0.2, opacity: 0, rotate: 180, filter: 'brightness(0.3) drop-shadow(0 0 0px #fff)', duration: 0.9, ease: 'power2.in' }, '<')
        .fromTo(q('.m-smoke'), { x: 0, y: 0, scale: 0.3, opacity: 0.95 },
          { x: () => gsap.utils.random(-200, 200), y: () => gsap.utils.random(-220, 20), scale: () => gsap.utils.random(2, 4), opacity: 0, duration: 2.2, ease: 'power1.out', stagger: 0.03 }, '<0.2')
        .fromTo(root.current, { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.2)' }, '<')
        .fromTo(q('.m-text'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, '<0.6');
    } else {
      // neúspěch: náraz, odraz, kouř
      tl.to(q('.m-core'), { scale: 2.4, opacity: 0, duration: 0.25 })
        .to(q('.m-a'), { x: -110, y: 0, rotate: -30, scale: 0.9, filter: 'brightness(0.8) drop-shadow(0 0 0px #fff)', duration: 0.5, ease: 'back.out(3)' }, '<')
        .to(q('.m-b'), { x: 110, y: 0, rotate: 30, scale: 0.9, filter: 'brightness(0.8) drop-shadow(0 0 0px #fff)', duration: 0.5, ease: 'back.out(3)' }, '<')
        .set(q('.m-a, .m-b'), { filter: 'grayscale(0.8) brightness(0.8)' })
        .fromTo(q('.m-smoke'), { x: 0, y: 0, scale: 0.3, opacity: 0.9 },
          { x: () => gsap.utils.random(-160, 160), y: () => gsap.utils.random(-120, 40), scale: () => gsap.utils.random(1.5, 3), opacity: 0, duration: 1.4, ease: 'power2.out', stagger: 0.02 }, '<')
        .fromTo(root.current, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.2)' }, '<')
        .fromTo(q('.m-text'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '<0.4');
    }
    return () => { tl.kill(); gsap.killTweensOf(q('.m-rays')); };
  }, [converged, result, error, fx.flashes, rarity, reduced]);

  const child = result?.pet;
  return (
    <div ref={root} className="fixed inset-0 z-[3000] flex flex-col items-center overflow-y-auto overflow-x-hidden p-6 text-white" role="dialog" aria-modal aria-label="Šlechtění"
      style={{ background: `radial-gradient(circle at 50% 38%, color-mix(in oklab, ${fx.color} ${result?.success ? 38 : 12}%, #0b1020), #05070d 70%)` }}>
      <div className="m-rays pointer-events-none absolute left-1/2 top-[38%] h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 opacity-0"
        style={{ background: `repeating-conic-gradient(from 0deg, ${fx.color}40 0deg 7deg, transparent 7deg 20deg)`, maskImage: 'radial-gradient(circle, #000 8%, transparent 55%)' }} />
      <div className="relative mt-[12vh] grid h-64 w-full max-w-sm shrink-0 place-items-center">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="m-spark absolute h-2 w-2 rounded-full opacity-0"
            style={{ background: i % 2 ? ELEMENT_GLOW[a.type] : ELEMENT_GLOW[b.type], boxShadow: `0 0 10px ${i % 2 ? ELEMENT_GLOW[a.type] : ELEMENT_GLOW[b.type]}` }} />
        ))}
        <span className="m-core absolute h-24 w-24 rounded-full opacity-0" style={{ background: 'radial-gradient(circle, #fff, rgba(255,255,255,0.4) 40%, transparent 70%)' }} />
        <span className="m-ring absolute h-24 w-24 rounded-full border-4 opacity-0" style={{ borderColor: fx.color, boxShadow: `0 0 30px ${fx.color}` }} />
        {Array.from({ length: fx.sparks }, (_, i) => (
          <span key={`c${i}`} className="m-confetti absolute h-2.5 w-2.5 opacity-0" style={{ background: i % 3 ? fx.color : '#fff', borderRadius: i % 2 ? '50%' : '2px' }} />
        ))}
        {Array.from({ length: 16 }, (_, i) => (
          <span key={`s${i}`} className="m-smoke absolute h-14 w-14 rounded-full opacity-0" style={{ background: 'radial-gradient(circle, rgba(148,163,184,0.85), transparent 70%)' }} />
        ))}
        <div className="m-a absolute"><PetArt type={a.type} type2={a.type2} seed={a.seed} stage={a.stage} rarity={a.rarity} size={150} /></div>
        <div className="m-b absolute"><PetArt type={b.type} type2={b.type2} seed={b.seed} stage={b.stage} rarity={b.rarity} size={150} /></div>
        {child && (
          <div className="m-child absolute opacity-0" style={{ filter: `drop-shadow(0 0 24px ${fx.color})` }}>
            <PetArt type={child.type} type2={child.type2} seed={child.seed} stage={child.stage} rarity={child.rarity} size={220} />
          </div>
        )}
      </div>

      <div className="m-text relative mt-4 w-full max-w-sm text-center opacity-0">
        {result?.success && child ? (
          <>
            <div className="text-sm uppercase tracking-[0.2em] opacity-80">Šlechtění se povedlo</div>
            <div className="mt-1 text-3xl font-black">{child.name}</div>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-sm">
              <span className="rounded-full px-3 py-1 font-bold text-black" style={{ background: fx.color }}>{RARITY[child.rarity].label}{result.rarity_up && ' ⬆'}</span>
              {result.new_species && <span className="rounded-full bg-white/15 px-3 py-1">Nový druh!</span>}
              {child.type2 && <span className="rounded-full bg-white/15 px-3 py-1">Kříženec</span>}
              {result.mutation && <span className="rounded-full bg-white/15 px-3 py-1">Mutace: {STAT_LABEL[result.mutation]} +20 %</span>}
            </div>
            {result.new_ability && <div className="mt-3 rounded-2xl bg-white/10 px-4 py-2 text-sm">Vyšlechtěné kouzlo: <b className="text-amber-200">✦ {result.new_ability}</b></div>}
            {done && <div className="mt-4 text-left text-foreground"><PetCard pet={child} /></div>}
          </>
        ) : result && !result.success ? (
          <>
            <div className="text-2xl font-black">{result.lost ? 'Zmizeli…' : 'Nepovedlo se…'}</div>
            <p className="mt-2 text-sm opacity-85">
              {result.lost
                ? `${a.name} a ${b.name} se k sobě nehodili a rozplynuli se v mlze. Jsou pryč. Stejný typ se spojí skoro vždy.`
                : `${a.name} a ${b.name} se k sobě nehodili. Tentokrát měli štěstí: oba zůstávají, jen jsou 30 minut vyčerpaní.`}
            </p>
          </>
        ) : null}
      </div>
      {error && <p role="alert" className="relative mt-4 rounded-lg bg-red-600/80 px-3 py-2 text-sm">{error}</p>}
      <button onClick={onClose} disabled={!done && !error}
        className="relative my-8 h-12 shrink-0 cursor-pointer rounded-xl bg-white px-8 font-bold text-black transition-opacity disabled:opacity-0">
        {result?.success ? 'Super!' : 'Zavřít'}
      </button>
      <div className="m-flash pointer-events-none fixed inset-0 bg-white opacity-0" />
    </div>
  );
}
