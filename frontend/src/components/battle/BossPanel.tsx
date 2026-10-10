'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crown, MapPin, Users } from 'lucide-react';
import { isInjured } from '@/components/battle/PetPicker';
import { PetArt } from '@/components/pet/PetCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { battleApi, errorMessage, gameApi, type BossInfo, type Pet } from '@/lib/api';
import { PET_TYPE, positionPayload } from '@/lib/game';
import { ELEMENT_GLOW } from '@/lib/petArt';
import { cn } from '@/lib/utils';

const MAX_LINEUP = 3; // stejně jako bosses.MAX_LINEUP na serveru

/** Boss týdne u místa: vyzvat ho jde jen na místě (do 300 m, ověřuje server stejně jako razítko), jednou za týden.
 * Sám, nebo s kamarády: hostitel otevře čekárnu, kamarádi na místě se přidají přes QR a hostitel souboj spustí. */
export function BossPanel({ placeId }: { placeId: number }) {
  const router = useRouter();
  const { user } = useAuth();
  const [boss, setBoss] = useState<BossInfo | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [lineup, setLineup] = useState<number[]>([]); // pořadí nástupu, nejvýš 3
  const [busy, setBusy] = useState<'' | 'solo' | 'party'>('');
  const [error, setError] = useState('');

  useEffect(() => {
    battleApi.bosses().then((bs) => setBoss(bs.find((b) => b.place.id === placeId) ?? null)).catch(() => {});
  }, [placeId, user]);
  useEffect(() => {
    if (!boss || !user) return;
    gameApi.myPets().then((ps) => {
      setPets(ps);
      // výchozí sestava: tři nejsilnější zdraví tvorové
      setLineup([...ps].filter((p) => !isInjured(p)).sort((a, b) => b.level - a.level || b.stage - a.stage).slice(0, MAX_LINEUP).map((p) => p.id));
    }).catch(() => {});
  }, [boss, user]);

  if (!boss) return null;
  const glow = ELEMENT_GLOW[boss.boss.type];

  const toggle = (id: number) =>
    setLineup((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX_LINEUP ? [...cur, id] : cur));

  const challenge = async (solo: boolean, demo = false) => {
    if (!lineup.length) return;
    setBusy(solo ? 'solo' : 'party');
    setError('');
    try {
      // s kamarády jde každý s jedním tvorem (první ze sestavy)
      const b = await battleApi.challengeBoss(placeId, { pet_ids: solo ? lineup : lineup.slice(0, 1), solo, ...(await positionPayload(demo)) });
      router.push(`/battle/${b.battle_id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy('');
    }
  };
  const until = new Date(boss.until).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric' });

  return (
    <section id="boss" className="mt-5 scroll-mt-20 overflow-hidden rounded-3xl border-2 border-amber-400/70 text-white"
      style={{ background: `radial-gradient(120% 90% at 80% 10%, color-mix(in oklab, ${glow} 55%, transparent), transparent 60%), linear-gradient(160deg, #3b0d0d, #120a14)` }}
      aria-labelledby="boss-h">
      <div className="flex items-center gap-3 p-4">
        <div className="pet-idle shrink-0 drop-shadow-[0_0_18px_rgba(250,204,21,0.55)]">
          <PetArt type={boss.boss.type} seed={boss.boss.seed} stage={3} rarity="legendary" size={110} />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.15em] text-amber-300"><Crown className="h-4 w-4" aria-hidden /> Boss týdne · do {until}</p>
          <h2 id="boss-h" className="mt-0.5 text-xl font-extrabold leading-tight">{boss.boss.name}</h2>
          <p className="mt-1 text-sm opacity-85">{PET_TYPE[boss.boss.type].label}, plně vyvinutý, o 2 levely nad tvým tvorem a s 2,5× víc životy.</p>
          <p className="mt-1 text-sm font-semibold text-amber-200">Odměna: legendární tvor a odznak</p>
        </div>
      </div>
      <div className="bg-black/25 p-4">
        {boss.fought ? (
          <p className="flex items-center gap-2 font-semibold"><Check className="h-5 w-5 text-emerald-300" aria-hidden />
            {boss.defeated ? 'Tento týden jsi ho porazil.' : 'Tento týden jsi s ním už bojoval.'} Příští týden se objeví jinde.</p>
        ) : !user ? (
          <p className="text-sm">Pro souboj s bosem si založ Pas.</p>
        ) : !pets.length ? (
          <p className="text-sm">Nejdřív potřebuješ tvora z razítka.</p>
        ) : (
          <>
            <p className="text-sm font-semibold">Koho pošleš na bosse?</p>
            <div className="mt-2 flex gap-2 overflow-x-auto rounded-2xl bg-background/95 p-2 text-foreground" role="group" aria-label="Sestava na bosse">
              {pets.map((p) => {
                const order = lineup.indexOf(p.id);
                const hurt = isInjured(p);
                return (
                  <button key={p.id} onClick={() => toggle(p.id)} disabled={hurt || (order < 0 && lineup.length >= MAX_LINEUP)} aria-pressed={order >= 0}
                    className={cn('relative w-24 shrink-0 cursor-pointer rounded-xl border-2 bg-card p-1.5 text-center disabled:cursor-not-allowed disabled:opacity-40',
                      order >= 0 ? 'border-amber-400 bg-amber-50 dark:bg-amber-400/10' : 'border-border')}>
                    {order >= 0 && <span className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-amber-400 text-xs font-black text-[#3b0d0d]">{order + 1}</span>}
                    <span className={cn('flex justify-center', hurt && 'grayscale')}><PetArt type={p.type} type2={p.type2} seed={p.seed} stage={p.stage} rarity={p.rarity} size={60} /></span>
                    <span className="block truncate text-xs font-semibold">{p.name}</span>
                    <span className="block text-[10px] text-muted-foreground">{hurt ? 'zraněný' : `${PET_TYPE[p.type].label}, lvl ${p.level}`}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs opacity-80">Sám si vezmi až 3 tvory: když jeden padne, nastoupí další podle pořadí. S kamarády jde každý s jedním (prvním).</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button size="lg" className="h-auto flex-col gap-0 bg-amber-400 py-2.5 text-[#3b0d0d] hover:bg-amber-300" isLoading={busy === 'solo'} disabled={!!busy || !lineup.length} onClick={() => challenge(true)}>
                <span className="flex items-center gap-1.5"><MapPin className="h-5 w-5" /> Bojovat sám</span>
                <span className="text-[11px] font-normal">sestava {lineup.length} {lineup.length === 1 ? 'tvor' : 'tvorové'}</span>
              </Button>
              <Button size="lg" variant="outline" className="h-auto flex-col gap-0 border-amber-400 bg-transparent py-2.5 text-white hover:bg-white/10" isLoading={busy === 'party'} disabled={!!busy || !lineup.length} onClick={() => challenge(false)}>
                <span className="flex items-center gap-1.5"><Users className="h-5 w-5" /> S kamarády</span>
              </Button>
            </div>
            <p className="mt-2 text-xs opacity-80">Musíš být do 300 m od místa. S bosem bojuješ jednou za týden. Kamarádi (až 2) se přidají přes QR kód, taky musí být tady.</p>
            {user.is_staff && (
              <button onClick={() => challenge(true, true)} disabled={!!busy || !lineup.length} className="mt-2 w-full text-sm underline opacity-80">Demo výzva bez kontroly vzdálenosti</button>
            )}
          </>
        )}
        {error && <p role="alert" className="mt-2 rounded-lg bg-red-600/80 p-2 text-sm">{error}</p>}
      </div>
    </section>
  );
}
