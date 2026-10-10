'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Dna, Star, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Guide } from '@/components/guide/Guide';
import { PetArt, PetCard, useInjury } from '@/components/pet/PetCard';
import { Evolution } from '@/components/pet/Evolution';
import { MergeScene } from '@/components/pet/MergeScene';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage, gameApi, type MergeOdds, type MergeResult, type Pet } from '@/lib/api';
import { PET_TYPE, RARITY } from '@/lib/game';
import { cn } from '@/lib/utils';

const RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };
const MAX_LEVEL_GAP = 1; // stejně jako pets.MERGE_MAX_LEVEL_GAP na serveru
type Sort = 'level' | 'rarity' | 'new' | 'type';
const SORTS: Record<Sort, [string, (a: Pet, b: Pet) => number]> = {
  level: ['Level', (a, b) => b.level - a.level || b.xp - a.xp],
  rarity: ['Rarita', (a, b) => RANK[b.rarity] - RANK[a.rarity] || b.level - a.level],
  type: ['Typ', (a, b) => a.type.localeCompare(b.type) || b.level - a.level],
  new: ['Nejnovější', (a, b) => b.created_at.localeCompare(a.created_at)],
};

/** Malá dlaždice tvora do mřížky. */
function Tile({ p, active, picked, blocked, onClick, onStar }: {
  p: Pet; active: boolean; picked: boolean; blocked?: boolean; onClick: () => void; onStar: () => void;
}) {
  const injured = useInjury(p.injured_until);
  return (
    <li className="relative">
      <button onClick={onClick} aria-pressed={active || picked} disabled={blocked}
        title={blocked ? `Moc velký rozdíl levelů (víc než ${MAX_LEVEL_GAP})` : undefined}
        className={cn('flex w-full cursor-pointer flex-col items-center rounded-2xl border-2 px-1 pb-2 pt-1 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-35 disabled:grayscale',
          picked ? 'border-trail-yellow bg-trail-yellow/15' : active ? 'border-primary bg-primary/10' : 'border-border bg-card')}
        style={!picked && !active ? { background: `linear-gradient(to bottom, color-mix(in oklab, ${PET_TYPE[p.type].color} 14%, var(--card)), var(--card) 70%)` } : undefined}>
        <span className={cn(injured && 'opacity-50 grayscale')}>
          <PetArt type={p.type} type2={p.type2} seed={p.seed} stage={p.stage} rarity={p.rarity} size={72} />
        </span>
        <span className="w-full truncate text-xs font-bold">{p.name}</span>
        <span className="text-[10px] text-muted-foreground">lvl {p.level} · <span className={cn('rounded px-0.5', RARITY[p.rarity].className)}>{RARITY[p.rarity].label}</span></span>
        {injured && <span className="absolute inset-x-1 top-1 rounded bg-destructive/90 text-[9px] font-semibold text-white">{injured} min</span>}
      </button>
      <button onClick={onStar} aria-label={p.favorite ? `Odebrat ${p.name} z oblíbených` : `Přidat ${p.name} do oblíbených`} aria-pressed={p.favorite}
        className="absolute right-0.5 top-0.5 grid h-8 w-8 cursor-pointer place-items-center rounded-full">
        <Star className={cn('h-4 w-4', p.favorite ? 'fill-trail-yellow text-trail-yellow' : 'text-muted-foreground/60')} />
      </button>
    </li>
  );
}

export default function PetsPage() {
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [evo, setEvo] = useState<{ pet: Pet; evolved: Pet | null; error: string } | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('level');
  const [index, setIndex] = useState(0);
  const [breeding, setBreeding] = useState(false);
  const [pair, setPair] = useState<number[]>([]);
  const [odds, setOdds] = useState<MergeOdds | null>(null);
  const [merge, setMerge] = useState<{ a: Pet; b: Pet; result: MergeResult | null; error: string } | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gameApi.myPets().then(setPets).catch((e) => { setPets([]); setError(errorMessage(e)); });
  }, []);

  const list = useMemo(() => [...(pets ?? [])].filter((p) => !favOnly || p.favorite).sort(SORTS[sort][1]), [pets, favOnly, sort]);
  const favCount = pets?.filter((p) => p.favorite).length ?? 0;

  // Šance pro vybraný pár
  useEffect(() => {
    if (pair.length !== 2) return;
    let alive = true;
    gameApi.mergeOdds(pair[0], pair[1]).then((o) => alive && setOdds(o)).catch((e) => alive && setError(errorMessage(e)));
    return () => { alive = false; setOdds(null); };
  }, [pair]);

  const replace = (p: Pet) => setPets((ps) => ps!.map((x) => (x.id === p.id ? p : x)));

  const save = async (id: number) => {
    try {
      replace(await gameApi.renamePet(id, name));
      setEditing(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const star = async (p: Pet) => {
    replace({ ...p, favorite: !p.favorite }); // hned, server potvrdí
    try {
      replace(await gameApi.favoritePet(p.id, !p.favorite));
    } catch (e) {
      replace(p);
      setError(errorMessage(e));
    }
  };

  const evolve = (pet: Pet) => {
    setEvo({ pet, evolved: null, error: '' });
    gameApi.evolvePet(pet.id)
      .then((p) => { setEvo((e) => e && { ...e, evolved: p }); replace(p); })
      .catch((e) => setEvo((x) => x && { ...x, error: errorMessage(e) }));
  };

  const goTo = (i: number) => {
    const el = strip.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  // Ke šlechtění se hodí jen tvorové s podobným levelem jako naposledy vybraný
  const anchor = pets?.find((x) => x.id === pair[pair.length - 1]);
  const blocked = (p: Pet) => breeding && !!anchor && !pair.includes(p.id) && Math.abs(p.level - anchor.level) > MAX_LEVEL_GAP;

  const tap = (p: Pet) => {
    if (!breeding) return goTo(list.findIndex((x) => x.id === p.id));
    if (blocked(p)) return;
    setPair((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id].slice(-2)));
  };

  const startMerge = () => {
    const [a, b] = pair.map((id) => pets!.find((p) => p.id === id)!);
    setMerge({ a, b, result: null, error: '' });
    gameApi.merge(a.id, b.id).then((r) => {
      setMerge((m) => m && { ...m, result: r });
      setPets((ps) => {
        if (!ps) return ps;
        if (!r.success && r.lost) return ps.filter((x) => !r.parents.includes(x.id));
        if (!r.success) {
          const until = new Date(Date.now() + 30 * 60000).toISOString();
          return ps.map((x) => (r.parents.includes(x.id) ? { ...x, injured_until: until } : x));
        }
        return [r.pet!, ...ps.filter((x) => !r.parents.includes(x.id))];
      });
    }).catch((e) => setMerge((m) => m && { ...m, error: errorMessage(e) }));
  };

  const closeMerge = () => {
    const child = merge?.result?.pet;
    setMerge(null);
    setPair([]);
    setBreeding(false);
    if (child) setTimeout(() => goTo(list.findIndex((x) => x.id === child.id)), 50);
  };

  const pairPets = pair.map((id) => pets?.find((p) => p.id === id)).filter(Boolean) as Pet[];

  return (
    <AppShell>
      {evo && <Evolution {...evo} onClose={() => setEvo(null)} />}
      {merge && <MergeScene {...merge} onClose={closeMerge} />}
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-extrabold">Tvorové</h1>
          {pets && pets.length > 0 && <p className="mt-1 text-muted-foreground">{pets.length} {pets.length === 1 ? 'tvor' : pets.length < 5 ? 'tvorové' : 'tvorů'}</p>}
        </div>
        {pets && pets.length >= 2 && (
          <Button variant={breeding ? 'secondary' : 'outline'} onClick={() => { setBreeding((v) => !v); setPair([]); }} aria-pressed={breeding}>
            {breeding ? <><X className="h-4 w-4" /> Zrušit</> : <><Dna className="h-4 w-4" /> Šlechtit</>}
          </Button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      {pets?.length === 0 && (
        <Guide who="vridla" className="mt-6"
          action={<Link href="/map" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Najít místo</Link>}>
          Zatím tu nikdo nebydlí. Každé razítko mi dá vejce a z něj ti vylíhnu tvora podle místa, kde jsi byl.
        </Guide>
      )}

      {breeding && (
        <Guide who="vridla" className="mt-4">
          Vyber dva tvory a já z nich vyšlechtím jednoho. Staty se smíchají a může se zlepšit rarita nebo vzniknout nové kouzlo.
          Dva různé typy dají křížence, ale nepovede se to vždycky, a pak můžou oba zmizet. Oba rodiče se spojí v jednoho.
          Spojit jde jen tvory, jejichž level se liší nejvýš o {MAX_LEVEL_GAP}.
        </Guide>
      )}

      {!breeding && list.length > 0 && (
        <section className="mt-4" aria-label="Detail tvora" aria-roledescription="carousel">
          <div ref={strip} onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
            className="-mx-4 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
            {list.map((p, i) => (
              <div key={p.id} className="w-full shrink-0 snap-center px-4" aria-roledescription="slide" aria-label={`${i + 1} z ${list.length}`}>
                <PetCard pet={p} onEvolve={() => evolve(p)}>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                    {editing === p.id ? (
                      <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); save(p.id); }}>
                        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Nové jméno" className="h-11" autoFocus />
                        <Button type="submit">Uložit</Button>
                      </form>
                    ) : (
                      <>
                        <Link href={`/place/${p.place.id}`} className="min-w-0 truncate text-primary underline">{p.place.name}</Link>
                        <div className="flex shrink-0 items-center">
                          <button onClick={() => star(p)} aria-pressed={p.favorite} aria-label={p.favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
                            className="grid h-11 w-11 cursor-pointer place-items-center rounded-lg hover:bg-accent">
                            <Star className={cn('h-5 w-5', p.favorite ? 'fill-trail-yellow text-trail-yellow' : 'text-muted-foreground')} />
                          </button>
                          <button className="h-11 cursor-pointer rounded-lg px-3 font-semibold hover:bg-accent" onClick={() => { setEditing(p.id); setName(p.name); }}>Přejmenovat</button>
                        </div>
                      </>
                    )}
                  </div>
                </PetCard>
              </div>
            ))}
          </div>
          {list.length > 1 && (
            <div className="mt-2 flex items-center justify-center gap-3 text-sm text-muted-foreground">
              <button onClick={() => goTo(Math.max(0, index - 1))} disabled={index === 0} aria-label="Předchozí tvor" className="grid h-10 w-10 cursor-pointer place-items-center rounded-full hover:bg-accent disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
              <span className="tabular-nums">{index + 1} / {list.length} · přejeď do strany</span>
              <button onClick={() => goTo(Math.min(list.length - 1, index + 1))} disabled={index >= list.length - 1} aria-label="Další tvor" className="grid h-10 w-10 cursor-pointer place-items-center rounded-full hover:bg-accent disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
            </div>
          )}
        </section>
      )}

      {pets && pets.length > 1 && (
        <section className="mt-6" aria-label="Všichni tvorové">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-muted p-1 text-sm font-semibold" role="group" aria-label="Filtr">
              <button onClick={() => setFavOnly(false)} aria-pressed={!favOnly} className={cn('cursor-pointer rounded-lg px-3 py-1.5', !favOnly && 'bg-card shadow-sm')}>Všichni {pets.length}</button>
              <button onClick={() => setFavOnly(true)} aria-pressed={favOnly} className={cn('flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5', favOnly && 'bg-card shadow-sm')}>
                <Star className="h-3.5 w-3.5 fill-trail-yellow text-trail-yellow" aria-hidden /> Oblíbení {favCount}
              </button>
            </div>
            <label className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
              Řadit
              <select value={sort} onChange={(e) => { setSort(e.target.value as Sort); goTo(0); }} className="h-9 rounded-lg border border-input bg-card px-2 text-sm text-foreground">
                {(Object.keys(SORTS) as Sort[]).map((k) => <option key={k} value={k}>{SORTS[k][0]}</option>)}
              </select>
            </label>
          </div>
          {list.length ? (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {list.map((p, i) => (
                <Tile key={p.id} p={p} active={!breeding && i === index} picked={pair.includes(p.id)} blocked={blocked(p)} onClick={() => tap(p)} onStar={() => star(p)} />
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted-foreground">Zatím nemáš oblíbené. Klepni na hvězdičku u tvora.</p>}
        </section>
      )}

      {breeding && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-4 rounded-2xl border-2 border-trail-yellow/70 bg-card p-3 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.4)]">
          <div className="flex items-center justify-center gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-border">
                {pairPets[i] ? <PetArt type={pairPets[i].type} type2={pairPets[i].type2} seed={pairPets[i].seed} stage={pairPets[i].stage} rarity={pairPets[i].rarity} size={60} /> : <span className="text-xs text-muted-foreground">vyber</span>}
              </div>
            )).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, <Dna key="dna" className="h-5 w-5 text-trail-yellow" aria-hidden />, el] : [el]), [])}
          </div>
          {odds && (
            <p className="mt-2 text-center text-sm">
              Šance na úspěch <b>{Math.round(odds.success * 100)} %</b>{odds.hybrid && ' (kříženec)'} · nové kouzlo {Math.round(odds.ability * 100)} % · vyšší rarita {Math.round(odds.rarity_up * 100)} %
              <span className="mt-1 block text-xs text-destructive">Když se to nepovede, s šancí {Math.round(odds.loss * 100)} % oba tvorové zmizí.</span>
            </p>
          )}
          <Button size="lg" className="mt-2 w-full" disabled={pair.length !== 2 || !odds} onClick={startMerge}>
            <Dna className="h-5 w-5" /> Spojit tvory
          </Button>
        </div>
      )}
    </AppShell>
  );
}
