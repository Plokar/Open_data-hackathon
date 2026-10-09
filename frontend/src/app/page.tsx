'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Landscape } from '@/components/brand/Landscape';
import { Logo, TrailMark, type TrailColor } from '@/components/brand/TrailMark';
import { GUIDES, GuideAvatar, type GuideId } from '@/components/guide/Guide';
import { useAuth } from '@/contexts/AuthContext';
import { gameApi, type Category } from '@/lib/api';
import { CATEGORY } from '@/lib/game';

const STEPS: { who: GuideId; trail: TrailColor; title: string; text: (n: number) => string }[] = [
  {
    who: 'kukadlo', trail: 'blue', title: 'Najdi místo',
    text: (n) => `Na mapě ${n ? `je ${n} míst` : 'jsou místa'} z otevřených dat kraje. U každého vidíš, jak je daleko a kde nejblíž staví autobus.`,
  },
  {
    who: 'boza', trail: 'red', title: 'Získej razítko',
    text: () => 'Dojdi blíž než 300 metrů a vyfoť ho. Poloha se ověří a razítko máš v Pasu. Foť místo, ne lidi.',
  },
  {
    who: 'vridla', trail: 'green', title: 'Vychovej tvora',
    text: () => 'Z každého razítka se vylíhne tvor podle místa, kde vznikl. Typy se přebíjí jako kámen, nůžky, papír, tak si vyber dobře, koho pošleš do souboje.',
  },
];

const HERO_GUIDES: { who: GuideId; size: number; left: string; delay: number }[] = [
  { who: 'boza', size: 78, left: '16%', delay: 150 },
  { who: 'vridla', size: 92, left: '50%', delay: 0 },
  { who: 'kukadlo', size: 78, left: '84%', delay: 300 },
];

export default function Home() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Partial<Record<Category, number>>>({});
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  useEffect(() => {
    gameApi.places().then((d) => {
      const c: Partial<Record<Category, number>> = {};
      for (const f of d.features) c[f.properties.category] = (c[f.properties.category] ?? 0) + 1;
      setCounts(c);
    }).catch(() => {});
  }, []);

  const cta = user ? { href: '/map', label: 'Pokračovat na mapu' } : { href: '/start', label: 'Vyrazit' };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-xl items-center justify-between px-4">
        <Logo />
        {!user && <Link href="/login" className="flex h-11 items-center rounded-full px-4 text-sm font-semibold hover:bg-accent">Mám účet</Link>}
      </header>

      {/* Krajina plynule přechází do zeleného hřebene, na kterém stojí text */}
      <section className="relative">
        <div className="relative h-[min(46vh,340px)] overflow-hidden">
          <Landscape className="absolute inset-0 h-full w-full" />
          <div className="relative mx-auto h-full max-w-xl">
            {HERO_GUIDES.map(({ who, size, left, delay }) => (
              <div key={who} className="hop-in absolute bottom-[6%]" style={{ left, animationDelay: `${delay}ms` }}>
                <div className="-translate-x-1/2"><GuideAvatar who={who} size={size} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[var(--hill-near)] text-[#f6f8f1]">
          <div className="mx-auto max-w-xl px-5 pb-10 pt-4">
            <h1 className="text-[2.75rem] font-extrabold leading-[0.98] tracking-[-0.035em]">Kraj, který se dá sbírat.</h1>
            <p className="mt-4 max-w-[34ch] text-[17px] leading-relaxed text-[#f6f8f1]/85">
              Hrady, rozhledny a prameny Karlovarského kraje. Dojdi na místo, vyfoť ho a dostaneš razítko do Pasu.
              Z každého razítka se ti vylíhne tvor.
            </p>
            <Link href={cta.href}
              className="mt-7 flex h-14 w-full items-center justify-center rounded-2xl bg-[#f6f8f1] text-lg font-bold text-[#1c2b22] shadow-[0_3px_0_0_rgb(0_0_0/0.25)] active:translate-y-px sm:w-auto sm:px-12 sm:inline-flex">
              {cta.label}
            </Link>
            {!user && <p className="mt-3 font-hand text-xl text-[#f6f8f1]/80">Stačí jméno. Za minutu jsi na mapě.</p>}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-xl px-5 py-12" aria-labelledby="jak">
        <h2 id="jak" className="text-2xl font-extrabold">Jak se hraje</h2>
        {/* Skutečná posloupnost kroků, proto trasa se zastávkami */}
        <ol className="relative mt-6 space-y-8 before:absolute before:bottom-6 before:left-[31px] before:top-6 before:border-l-[3px] before:border-dotted before:border-trail-red/60">
          {STEPS.map(({ who, trail, title, text }) => (
            <li key={who} className="relative flex gap-4">
              <GuideAvatar who={who} size={64} className="relative rounded-full bg-background" />
              <div className="pt-1">
                <h3 className="flex items-center gap-2 text-lg font-bold"><TrailMark color={trail} />{title}</h3>
                <p className="mt-1 leading-relaxed text-muted-foreground">{text(total)}</p>
                <p className="mt-1 font-hand text-lg text-primary">{GUIDES[who].name}, {GUIDES[who].role}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-border bg-card" aria-labelledby="co">
        <div className="mx-auto max-w-xl px-5 py-10">
          <h2 id="co" className="text-2xl font-extrabold">{total ? `${total} míst, kam se dá dojít` : 'Místa, kam se dá dojít'}</h2>
          <p className="mt-2 text-muted-foreground">Všechno z veřejných dat Karlovarského kraje na portálu DATA ZÁPAD.</p>
          <ul className="mt-5 grid grid-cols-2 gap-x-6">
            {(Object.keys(CATEGORY) as Category[]).map((c) => {
              const { Icon, label, color } = CATEGORY[c];
              return (
                <li key={c} className="flex items-center gap-3 border-b border-border py-3">
                  <Icon className="h-5 w-5 shrink-0" style={{ color }} aria-hidden />
                  <span className="min-w-0 flex-1 text-sm leading-tight">{label}</span>
                  <span className="font-bold tabular-nums">{counts[c] ?? ''}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-xl px-5 py-12">
        <h2 className="text-2xl font-extrabold">Bez auta to jde taky</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          U každého místa ukážeme nejbližší autobusovou zastávku. A když tě baví víc jídlo než hrady,
          oceněné Dobroty kraje mají vlastní razítka.
        </p>
        <Link href={cta.href} className="mt-6 flex h-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-[0_3px_0_0_rgb(0_0_0/0.2)] active:translate-y-px">
          {cta.label}
        </Link>
      </section>

      <footer className="mx-auto max-w-xl px-5 pb-10 text-xs leading-relaxed text-muted-foreground">
        Data: <a className="underline" href="https://www.datazapad.cz" target="_blank" rel="noreferrer">DATA ZÁPAD</a> (Karlovarský kraj, CC0), mapa © OpenStreetMap.
        Vzniklo na Hackathonu Karlovarského kraje 2026. <Link className="underline" href="/privacy">Soukromí</Link>, <Link className="underline" href="/insights">co hráči objevují</Link>.
      </footer>
    </div>
  );
}
