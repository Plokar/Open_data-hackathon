'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, X } from 'lucide-react';
import type { BattleFighter, MoveInfo, Pet, PetType, StatusId, TurnEvent } from '@/lib/api';
import type { BattleScene } from '@/lib/battleFx';
import { BEATS, PET_TYPE, STATUS, fmtMult } from '@/lib/game';
import { cn } from '@/lib/utils';

/** Co tah dělá, lidsky. Čísla a efekty bere dialog z backendu (engine.MOVES). */
const MOVE_TEXT: Record<string, string> = {
  attack: 'Obyčejný výpad bez živlu. Nic nestojí, takže se hodí, když dochází výdrž.',
  heavy: 'Tvor se vymrští a dopadne celou vahou. Prorazí i Obranu, ale občas mine.',
  guard: 'Tvor se kryje: první zásah v tomto tahu ho bolí jen napůl a výdrž se obnoví rychleji.',
  rockfall: 'Z hradeb se utrhnou kameny a zasypou soupeře. Zasypaný tvor je pomalý a jedná až po tobě.',
  bastion: 'Kolem tvora vyroste hradní zeď. Kryje jako Obrana, nejde prorazit a k tomu trochu vyléčí.',
  siege_fire: 'Hořící střela z hradeb. Soupeř pak ještě tři tahy hoří.',
  gust: 'Poryv větru z rozhledny. Je tak rychlý, že jde vždycky první, a odfoukne soupeři kus výdrže.',
  thunder: 'Blesk z mraků nad vyhlídkou. Promočeného soupeře zasáhne mnohem silněji.',
  sunbeam: 'Soustředěné světlo z výšin. Projde i silnou obranou, takže je to zbraň na Pevnosti.',
  vines: 'Šlahouny se soupeři omotají kolem nohou, vysají z něj sílu a nepustí ho do Obrany.',
  spores: 'Oblak pylu soupeři vleze do nosu. Dva tahy pak útočí i kouzlí slaběji.',
  forest_wrath: 'Na soupeře se snese celý les. Spoutaného zasáhne o polovinu silněji.',
  jet: 'Prudký proud minerálky. Soupeře promočí, a když hoří, uhasí ho.',
  healing_spring: 'Tvor se napije z léčivého pramene, uzdraví se a smyje ze sebe neduhy.',
  geyser: 'Pod soupeřem vytryskne vřídlo. Obrana proti němu nepomůže a soupeř zůstane promočený.',
  echo: 'Tón varhan se odrazí od klenby. Omámený soupeř příští tah možná zaváhá.',
  fresco_curse: 'Postavy z fresek ožijí a soupeře proklejí. Tři tahy se pak léčí jen napůl.',
  choir: 'Chorál, ze kterého se třesou okna. Čím víc neduhů soupeř má, tím víc bolí.',
  honey: 'Lepkavá medová koule. Zalepenému soupeři se dva tahy neobnovuje výdrž.',
  feast: 'Tvor si dá pořádnou svačinu: trochu se uzdraví a dva tahy útočí silněji.',
  cake_storm: 'Tři koláče ze tří stran. Obrana zachytí jen ten první.',
  aurora: 'Závoj polární záře bez živlu: nikdy nemine a smyje z tvora neduhy.',
  quake: 'Země se otřese jako v Krušných horách. Zasáhne všechny soupeře a prorazí jim Obranu.',
  meteor: 'Z nebe padají meteory a zapálí soupeře. Nejsilnější kouzlo ve hře, ale občas mine.',
  living_water: 'Živá voda z pohádek: vyléčí skoro polovinu života a smyje neduhy.',
  leech_bloom: 'Květ u nohou soupeře ho spoutá a vysaje většinu zranění zpátky do tvora.',
  twin_bolt: 'Dva blesky hned po sobě. Na promočeného ještě silnější.',
};

const pct = (x: number) => `${Math.round(x * 100)} %`;
const turns = (n: number) => `${n} ${n === 1 ? 'tah' : n < 5 ? 'tahy' : 'tahů'}`;

/** Ukázkový tah: tvůj tvor proti cvičnému soupeři stejného typu (bez typové výhody, jako odhad zranění). */
function demoEvent(m: MoveInfo, pet: Pet): TurnEvent {
  const base = { actor: 'a', move: m.id, name: m.name, kind: m.kind, fx: m.fx, cost: m.cost, elem: m.elem };
  if (m.kind === 'guard' || !m.power) {
    return { ...base, heal: Math.floor(pet.stats.hp * (m.heal ?? 0)), buff: m.self_status?.[0], cleansed: m.cleanse ? ['curse'] : undefined };
  }
  const damage = m.damage ?? 0, n = m.hits ?? 1;
  return {
    ...base, target: 'b', hit: true, crit: false, effectiveness: 1, damage, heal: Math.floor(damage * (m.drain ?? 0)),
    hits: m.hits ? Array.from({ length: n }, () => Math.floor(damage / n)) : undefined, status: m.status?.[0], sap: m.sap,
  };
}

/** Co přesně tah dělá: odkud bere sílu, živel, efekty, kombo a kolikrát ho z výdrže zvládneš. */
function effectsOf(m: MoveInfo, pet: Pet) {
  const beats = m.elem && BEATS[m.elem];
  const beatenBy = m.elem && (Object.keys(BEATS) as PetType[]).find((k) => BEATS[k] === m.elem);
  const st = m.status && STATUS[m.status[0]], self = m.self_status && STATUS[m.self_status[0]];
  return [
    m.kind === 'phys' && `Sílu bere z Útoku tvého tvora (${pet.stats.atk}).`,
    m.kind === 'magic' && m.power > 0 && `Sílu bere z Magie tvého tvora (${pet.stats.mag}).`,
    m.power > 0 && !m.elem && 'Bez živlu: na každý typ soupeře platí stejně.',
    m.power > 0 && m.elem && (beats || beatenBy
      ? `Živel ${PET_TYPE[m.elem].label}: ${beats ? `proti typu ${PET_TYPE[beats].label} ${fmtMult(1.5)}` : ''}${beats && beatenBy ? ', ' : ''}${beatenBy ? `proti typu ${PET_TYPE[beatenBy].label} jen ${fmtMult(0.75)}` : ''}.`
      : `Živel ${PET_TYPE[m.elem].label} nemá silné ani slabé soupeře.`),
    m.power > 0 && m.acc < 1 && `Mine zhruba v ${pct(1 - m.acc)} případů.`,
    m.hits && `Zasáhne ${m.hits}× za sebou, Obrana zachytí jen první zásah.`,
    m.aoe && 'Zasáhne všechny soupeře najednou.',
    m.first && 'Jde vždycky první, i před rychlejším soupeřem.',
    m.break && 'Prorazí Obranu: kdo se kryje, dostane plné zranění. Hradní štít ale vydrží.',
    m.pierce && `Ignoruje ${pct(m.pierce)} obrany soupeře, hodí se na tvory s vysokou obranou.`,
    m.sap && `Soupeři ubere ${m.sap} výdrže, takže nemusí stihnout své silné kouzlo.`,
    st && `Soupeř je ${turns(m.status![1])} ${st.label.toLowerCase()}: ${st.text}.`,
    self && `Tvůj tvor je ${turns(m.self_status![1])} ${self.label.toLowerCase()}: ${self.text}.`,
    ...Object.entries(m.vs ?? {}).map(([k, x]) => `Kombo: na ${STATUS[k as StatusId].whom} soupeře ${fmtMult(x!)}.`),
    m.per_status && `Kombo: za každý neduh soupeře +${pct(m.per_status)}, nejvýš +${pct(m.per_status * 3)}.`,
    m.drain && `Vrátí ${pct(m.drain)} způsobeného zranění jako život.`,
    m.kind === 'guard' && !m.solid && 'První zásah v tomto tahu ubere jen polovinu.',
    m.solid && 'Kryje jako Obrana a nejde prorazit ani Silným úderem.',
    m.id === 'guard' && 'Výdrž se po ní obnoví víc než po útoku.', // engine: GUARD_REGEN jen za obyčejnou Obranu
    m.heal && `Vyléčí ${pct(m.heal)} života (asi ${Math.floor(pet.stats.hp * m.heal)}).`,
    m.cleanse && 'Smaže z tvého tvora všechny neduhy.',
    m.in_row && `Z plné výdrže (${pet.stats.stamina}) ho použiješ ${m.in_row}× za sebou, pak musíš šetřit.`,
    m.bred && 'Vyšlechtěné kouzlo: dá se získat jen spojením dvou tvorů.',
  ].filter(Boolean) as string[];
}

function fightersFor(pet: Pet): BattleFighter[] {
  const common = { owner: null, guard: false, type: pet.type, hp: pet.stats.hp, max_hp: pet.stats.hp, level: pet.level };
  return [
    { ...common, slot: 'a', team: 'a', me: true, ally: false, type2: pet.type2, name: pet.name, seed: pet.seed, stage: pet.stage, rarity: pet.rarity },
    { ...common, slot: 'b', team: 'b', me: false, ally: false, type2: '', name: 'Cvičný soupeř', seed: pet.seed + 1, stage: 1, rarity: 'common' },
  ];
}

function MovePreview({ pet, move }: { pet: Pet; move: MoveInfo }) {
  const el = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<BattleScene | null>(null);
  const [say, setSay] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);  // dvě animace přes sebe by se v aréně pomíchaly

  // Stejná Pixi scéna jako v souboji (StrictMode ji stihne zrušit uprostřed initu, proto `cancelled`)
  useEffect(() => {
    let cancelled = false, s: BattleScene | null = null;
    import('@/lib/battleFx').then(({ BattleScene }) => BattleScene.create(el.current!, fightersFor(pet))).then((x) => {
      if (cancelled) x.destroy();
      else { s = x; setScene(x); }
    });
    return () => { cancelled = true; s?.destroy(); };
  }, [pet]);

  const play = useCallback(async () => {
    if (!scene || running.current) return;
    running.current = true;
    setBusy(true);
    // ponytail: obrovské HP v ukázce, ať cvičný soupeř nikdy nepadne
    await scene.play(demoEvent(move, pet), { a: 1e6, b: 1e6 }, { say: setSay, change: () => {} });
    running.current = false;
    setBusy(false);
    setSay('');
  }, [scene, move, pet]);

  // Sám se přehraje po nástupu do arény (a po přepnutí útoku), jen když hráč nechce omezit pohyb
  useEffect(() => {
    if (!scene || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(play, 1000);
    return () => clearTimeout(t);
  }, [scene, play]);

  return (
    <div>
      <div className="relative overflow-hidden bg-[#0b0e16]" style={{ aspectRatio: '480 / 340' }}>
        <div ref={el} className="absolute inset-0" />
        {!scene && <div className="absolute inset-0 grid place-items-center text-sm text-white/70">Připravuji arénu…</div>}
      </div>
      <div className="flex min-h-12 items-center justify-between gap-3 border-y-4 border-[#2a2f45] bg-[#141826] px-4 py-2 text-[15px] font-semibold text-white" aria-live="polite">
        <span>{say || (busy ? '…' : 'Ukázka proti cvičnému soupeři')}</span>
        <button onClick={play} disabled={!scene || busy}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40">
          <Play className="h-4 w-4" aria-hidden /> Přehrát
        </button>
      </div>
    </div>
  );
}

/** Detail útoku z karty tvora: ukázka v aréně, popis a co přesně dělá. */
export function MoveDialog({ pet, moveId, onPick, onClose }: {
  pet: Pet; moveId: string; onPick: (id: string) => void; onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = overflow; };
  }, [onClose]);

  const m = pet.moves.find((x) => x.id === moveId) ?? pet.moves[0];
  const t = m.elem ? PET_TYPE[m.elem] : null;
  const effects = effectsOf(m, pet);
  const kind = m.kind === 'phys' ? 'Fyzický útok' : m.kind === 'guard' ? 'Obrana' : m.power ? 'Kouzlo' : 'Léčivé kouzlo';

  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="move-title" onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <MovePreview pet={pet} move={m} />
        <div className="relative p-4">
          <button ref={close} onClick={onClose} aria-label="Zavřít"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" aria-hidden />
          </button>
          <h2 id="move-title" className="pr-10 text-xl font-bold leading-tight">{m.name}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-semibold">
            <span className="rounded-full bg-muted px-2 py-0.5">{kind}</span>
            {t && <span className="rounded-full px-2 py-0.5 text-white" style={{ background: t.color }}>{t.label}</span>}
            {m.bred && <span className="rounded-full bg-trail-yellow/30 px-2 py-0.5">Vyšlechtěné</span>}
          </div>
          <p className="mt-3 leading-relaxed">{MOVE_TEXT[m.id] ?? 'Útok tvého tvora.'}</p>

          <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              ['Síla', m.power ? m.power * (m.hits ?? 1) : '–'],
              ['Zranění', m.power ? `≈ ${m.damage}` : '–'],
              ['Přesnost', m.power ? pct(m.acc) : '–'],
              ['Výdrž', m.cost || 'zdarma'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-muted px-1 py-2">
                <dt className="text-[11px] text-muted-foreground">{label}</dt>
                <dd className="text-base font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {m.power > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Zranění je průměr proti stejně silnému tvorovi bez typové výhody.</p>}

          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-snug">
            {effects.map((x) => <li key={x}>{x}</li>)}
          </ul>

          {pet.moves.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Další útoky">
              {pet.moves.map((x) => (
                <button key={x.id} onClick={() => onPick(x.id)} aria-pressed={x.id === m.id}
                  className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', x.id === m.id ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/70')}>
                  {x.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
