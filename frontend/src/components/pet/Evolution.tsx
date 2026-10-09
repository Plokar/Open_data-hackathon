'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { Pet } from '@/lib/api';
import { ELEMENT_GLOW } from '@/lib/petArt';
import { PetArt } from './PetCard';

const STAGE_LABEL = ['', 'Mládě', 'Dospělec', 'Prastarý'];
const WHITE = 'brightness(0) invert(1) drop-shadow(0 0 18px #fff)';

/** Celoobrazovková evoluce: silueta střídá starou a novou podobu, záblesk, odhalení. Výsledek z API čeká na konci. */
export function Evolution({ pet, evolved, error, onClose }: { pet: Pet; evolved: Pet | null; error: string; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  // Evoluce se otevírá až po kliknutí, takže window tu vždy je
  const [done, setDone] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const glow = ELEMENT_GLOW[pet.type];
  const newMove = evolved?.moves.find((m) => !pet.moves.some((x) => x.id === m.id));

  useEffect(() => {
    const q = gsap.utils.selector(root);
    if (done) {
      gsap.set(q('.evo-old'), { opacity: 0 });
      gsap.set(q('.evo-new, .evo-rays, .evo-text'), { opacity: 1 });
      return;
    }
    const sparks = q('.evo-spark');
    sparks.forEach((s) => gsap.fromTo(s,
      { x: gsap.utils.random(-140, 140), y: 160, scale: gsap.utils.random(0.4, 1.2), opacity: 0 },
      { y: gsap.utils.random(-220, -80), opacity: 1, duration: gsap.utils.random(1.2, 2.4), repeat: -1, delay: gsap.utils.random(0, 2), ease: 'power1.out' }));

    const tl = gsap.timeline({ onComplete: () => setDone(true) });
    tl.fromTo(q('.evo-old'), { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' })
      .to(q('.evo-old'), { filter: WHITE, duration: 0.9 }, '+=0.3')
      .set(q('.evo-new'), { filter: WHITE });
    // střídání siluet, čím dál rychleji
    let d = 0.42;
    for (let i = 0; i < 12; i++) {
      const showNew = i % 2 === 0;
      tl.set(q('.evo-old'), { opacity: showNew ? 0 : 1, scale: showNew ? 1 : 0.92 }, `+=${d}`)
        .set(q('.evo-new'), { opacity: showNew ? 1 : 0, scale: showNew ? 1.1 : 1 }, '<');
      d *= 0.8;
    }
    tl.to(q('.evo-flash'), { opacity: 1, duration: 0.18, ease: 'power2.in' })
      .set(q('.evo-old'), { opacity: 0 })
      .set(q('.evo-new'), { opacity: 1, filter: 'none', scale: 1.3 })
      .to(q('.evo-flash'), { opacity: 0, duration: 1.1, ease: 'power2.out' })
      .to(q('.evo-new'), { scale: 1, duration: 1.3, ease: 'elastic.out(1, 0.45)' }, '<')
      .to(q('.evo-rays'), { opacity: 1, duration: 0.6 }, '<')
      .fromTo(q('.evo-text'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '<0.4');
    gsap.to(q('.evo-rays'), { rotate: 360, duration: 16, repeat: -1, ease: 'none' });
    return () => { tl.kill(); gsap.killTweensOf(sparks); gsap.killTweensOf(q('.evo-rays')); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- choreografie běží jednou
  }, []);

  return (
    <div ref={root} className="fixed inset-0 z-[3000] flex flex-col items-center justify-center overflow-hidden p-6 text-white" role="dialog" aria-modal aria-label="Evoluce"
      style={{ background: `radial-gradient(circle at 50% 45%, color-mix(in oklab, ${glow} 45%, #0b1020), #05070d 70%)` }}>
      <div className="evo-rays pointer-events-none absolute left-1/2 top-[45%] h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 opacity-0"
        style={{ background: `repeating-conic-gradient(from 0deg, ${glow}33 0deg 8deg, transparent 8deg 22deg)`, maskImage: 'radial-gradient(circle, #000 10%, transparent 55%)' }} />
      <div className="relative grid h-64 w-64 place-items-center">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="evo-spark absolute h-2 w-2 rounded-full opacity-0" style={{ background: i % 3 ? glow : '#fff', boxShadow: `0 0 12px ${glow}` }} />
        ))}
        <PetArt className="evo-old absolute" type={pet.type} seed={pet.seed} stage={pet.stage} rarity={pet.rarity} size={240} />
        <PetArt className="evo-new absolute opacity-0" type={pet.type} seed={pet.seed} stage={Math.min(3, pet.stage + 1)} rarity={pet.rarity} size={240} />
      </div>
      <div className="evo-text relative mt-6 text-center opacity-0">
        <div className="text-sm uppercase tracking-[0.2em] opacity-80">Evoluce</div>
        <div className="mt-1 text-3xl font-black">{pet.name}</div>
        <div className="mt-1 text-lg">je teď <b style={{ color: glow }}>{STAGE_LABEL[pet.stage + 1]}</b></div>
        {newMove && <div className="mt-3 rounded-full bg-white/10 px-4 py-1.5 text-sm">Nové kouzlo: <b>✦ {newMove.name}</b></div>}
        <div className="mt-1 text-xs opacity-70">Všechny staty +{pet.stage === 1 ? 20 : 21} %</div>
      </div>
      {error && <p role="alert" className="relative mt-4 rounded-lg bg-red-600/80 px-3 py-2 text-sm">{error}</p>}
      <button onClick={onClose} disabled={!done && !error}
        className="relative mt-8 h-12 cursor-pointer rounded-xl bg-white px-8 font-bold text-black transition-opacity disabled:opacity-0">
        Super!
      </button>
      <div className="evo-flash pointer-events-none absolute inset-0 bg-white opacity-0" />
    </div>
  );
}
