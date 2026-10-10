'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bandage, Crown, Crosshair, Handshake, Hammer, MapPin, Moon, Play, Shield, Sparkles, Sword, Trophy, UserPlus, Zap } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Arena } from '@/components/battle/Arena';
import { PetPicker } from '@/components/battle/PetPicker';
import { PetArt, PetCard } from '@/components/pet/PetCard';
import { ShareQr } from '@/components/ui/share-qr';
import { Button } from '@/components/ui/button';
import { useWebSocket, type WsMessage } from '@/hooks/useWebSocket';
import { useAuth } from '@/contexts/AuthContext';
import {
  battleApi, errorMessage, gameApi,
  type BattleDetail, type BattleEnd, type BattleFighter, type BattleMode, type BattleState, type MoveInfo, type Pet, type TurnResult,
} from '@/lib/api';
import { PET_TYPE, positionPayload } from '@/lib/game';
import { ELEMENT_GLOW } from '@/lib/petArt';
import { cn } from '@/lib/utils';

const MODE_LABEL: Record<BattleMode, string> = {
  ranked: 'Hodnocený souboj', friendly: 'Přátelský souboj', practice: 'Trénink', ffa: 'Všichni proti všem', team: 'Týmový souboj 2v2', boss: 'Souboj s bosem',
};
const TEAM_LABEL: Record<string, string> = { red: 'Červení', blue: 'Modří' };
const TEAM_COLOR: Record<string, string> = { red: 'bg-red-500', blue: 'bg-blue-500' };

function describe(r: TurnResult, name: (slot?: string) => string) {
  return r.events.map((e) => {
    const who = name(e.actor);
    if (e.kind === 'guard') return `${who}: ${e.name}${e.heal ? `, +${e.heal} HP` : ''}.`;
    if (!e.damage && e.heal) return `${who}: ${e.name}, +${e.heal} HP.`;
    const on = e.target ? ` na ${name(e.target)}` : '';
    if (!e.hit) return `${who}: ${e.name}${on}, vedle!`;
    const eff = e.effectiveness === 1.5 ? ' Velmi účinné!' : e.effectiveness === 0.75 ? ' Málo účinné.' : '';
    return `${who}: ${e.name}${on} za ${e.damage}${e.crit ? ' (kritický zásah)' : ''}.${eff}${e.heal ? ` Vysál +${e.heal} HP.` : ''}`;
  });
}

const MOVE_ICON = { attack: Sword, heavy: Hammer, guard: Shield } as Record<string, typeof Sword>;
const needsTarget = (m: MoveInfo) => m.kind !== 'guard' && m.power > 0;

function MoveButton({ m, sp, disabled, onClick, active }: { m: MoveInfo; sp: number; disabled: boolean; onClick: () => void; active?: boolean }) {
  const Icon = MOVE_ICON[m.id] ?? (m.kind === 'guard' ? Shield : Sparkles);
  const broke = sp < m.cost;
  const t = m.type ?? 'fortress';
  const magic = m.kind === 'magic' || m.id === 'bastion';
  const hint = m.power ? `síla ${m.power}${m.acc < 1 ? ` · ${Math.round(m.acc * 100)} %` : ''}` : m.heal ? `léčí ${Math.round(m.heal * 100)} %` : '½ zranění';
  return (
    <button onClick={onClick} disabled={disabled || broke} aria-label={`${m.name}, ${hint}, výdrž ${m.cost}`} aria-pressed={active}
      className={cn('relative flex min-h-16 cursor-pointer flex-col items-start justify-center overflow-hidden rounded-2xl border-b-4 px-3 py-2 text-left text-white transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40',
        !magic && (m.kind === 'guard' ? 'border-sky-900 bg-sky-700' : 'border-[#1d2a22] bg-[#2e3d34]'), active && 'ring-4 ring-trail-yellow')}
      style={magic ? { background: `linear-gradient(135deg, ${PET_TYPE[t].color}, color-mix(in oklab, ${ELEMENT_GLOW[t]} 55%, ${PET_TYPE[t].color}))`, borderColor: 'rgb(0 0 0 / 0.35)' } : undefined}>
      {m.bred && <span className="absolute right-2 top-1 text-[9px] font-black uppercase tracking-wide text-trail-yellow">vyšlechtěné</span>}
      <span className="flex items-center gap-1.5 text-sm font-bold leading-tight"><Icon className="h-4 w-4 shrink-0" aria-hidden />{m.name}</span>
      <span className="mt-0.5 flex w-full items-center justify-between text-[11px] opacity-85">
        <span>{hint}</span>
        <span className={cn('flex items-center gap-0.5 font-semibold', broke && 'text-red-200')}><Zap className="h-3 w-3" aria-hidden />{m.cost}</span>
      </span>
    </button>
  );
}

/** Čekárna skupinového souboje: obsazená a volná místa (u 2v2 po týmech, u bosse parta a boss). */
function Lobby({ s }: { s: Pick<BattleState, 'size' | 'mode' | 'fighters'> }) {
  const boss = s.fighters.find((f) => f.boss);
  const slots = s.mode === 'boss' ? ['a', 'c', 'd'] : 'abcd'.slice(0, s.size).split('');
  const team = (slot: string) => (s.mode === 'team' ? ({ a: 'red', b: 'blue', c: 'red', d: 'blue' } as Record<string, string>)[slot] : '');
  return (
    <>
    {boss && (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-amber-400/70 bg-gradient-to-r from-amber-300/25 to-red-400/15 p-2.5 text-left">
        <PetArt type={boss.type} seed={boss.seed} stage={3} rarity="legendary" size={64} />
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300"><Crown className="h-3.5 w-3.5" aria-hidden /> Boss</span>
          <span className="block truncate font-bold">{boss.name}</span>
          <span className="block text-xs text-muted-foreground">Čím víc vás je, tím víc má životů.</span>
        </span>
      </div>
    )}
    <ul className={cn('mt-3 grid gap-2', s.size === 4 && s.mode !== 'boss' ? 'grid-cols-2' : 'grid-cols-3')}>
      {slots.sort((x, y) => team(x).localeCompare(team(y)) || x.localeCompare(y)).map((slot) => {
        const f = s.fighters.find((x) => x.slot === slot);
        return (
          <li key={slot} className={cn('relative flex flex-col items-center rounded-2xl border-2 p-2 text-center', f ? 'border-border bg-card' : 'border-dashed border-border text-muted-foreground')}>
            {team(slot) && <span className={cn('absolute left-2 top-2 h-2.5 w-2.5 rounded-full', TEAM_COLOR[team(slot)])} aria-label={TEAM_LABEL[team(slot)]} />}
            {f ? <PetArt type={f.type} type2={f.type2 || ''} seed={f.seed} stage={f.stage} rarity={f.rarity} size={64} /> : <UserPlus className="my-4 h-8 w-8 opacity-50" aria-hidden />}
            <div className="w-full truncate text-sm font-bold">{f ? f.owner : 'volno'}</div>
            {f && <div className="w-full truncate text-[11px] text-muted-foreground">{f.name}, lvl {f.level}</div>}
          </li>
        );
      })}
    </ul>
    </>
  );
}

export default function BattlePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [detail, setDetail] = useState<BattleDetail | null>(null);
  const [state, setState] = useState<BattleState | null>(null);
  const [results, setResults] = useState<TurnResult[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [end, setEnd] = useState<BattleEnd | null>(null);
  const [oppGone, setOppGone] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [myPets, setMyPets] = useState<Pet[]>([]);
  const [joinPet, setJoinPet] = useState<number | null>(null);
  const [joinTeam, setJoinTeam] = useState<string>('');
  const [picked, setPicked] = useState<MoveInfo | null>(null);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const names = useRef<Record<string, string>>({});

  const load = useCallback(() => {
    battleApi.get(id).then((d) => {
      setDetail(d);
      if (d.result) setEnd(d.result);
      if (d.joinable) gameApi.myPets().then((ps) => { setMyPets(ps); setJoinPet(ps[0]?.id ?? null); });
    }).catch((e) => setError(errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  const onMessage = useCallback((m: WsMessage) => {
    if (m.type === 'state') {
      const st = m as unknown as BattleState;
      names.current = Object.fromEntries(st.fighters.map((f) => [f.slot, f.me ? `${f.name} (ty)` : f.name]));
      setState(st);
    } else if (m.type === 'turn_result') {
      const r = m as unknown as TurnResult;
      setOppGone(false);
      setResults((prev) => [...prev, r]);
      const ls = describe(r, (slot) => names.current[slot ?? ''] ?? '?').map((l) => `${r.turn}. ${l}`);
      setLines((prev) => [...ls.reverse(), ...prev].slice(0, 40));
    } else if (m.type === 'battle_end') {
      setEnd(m as unknown as BattleEnd);
    } else if (m.type === 'opponent_disconnected') {
      setOppGone(true);
    }
  }, []);

  const { status, send } = useWebSocket(detail?.is_participant ? `/ws/battle/${id}/` : null, {
    onMessage,
    onOpen: (s) => s({ type: 'ready' }),
  });

  // Konec až po doběhnutí animací; prodleva pokryje i chvilku, než aréna začne přehrávat poslední tah.
  useEffect(() => {
    if (!end || animating) return;
    const t = setTimeout(() => setShowEnd(true), 700);
    return () => clearTimeout(t);
  }, [end, animating]);

  useEffect(() => {
    if (state?.status !== 'active') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [state?.status]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- adresa až po hydrataci
  useEffect(() => setUrl(window.location.href.split('?')[0]), []);

  const enemies = useMemo(() => state?.fighters.filter((f) => !f.ally && !f.me && f.hp > 0) ?? [], [state]);

  const move = (m: MoveInfo, target?: string) => {
    if (!state?.turn) return;
    if (!target && needsTarget(m) && enemies.length > 1) return setPicked(m); // víc soupeřů: nejdřív cíl
    send({ type: 'move', turn: state.turn, move: m.id, target: target ?? enemies[0]?.slot ?? null });
    setPicked(null);
    setState({ ...state, waiting_for_you: false });
  };

  const [joining, setJoining] = useState(false);
  const join = async (demo = false) => {
    if (!joinPet) return;
    setJoining(true);
    setError('');
    try {
      // k bossovi se přidáš jen na místě: poloha jde na server jako u razítka
      const pos = detail?.mode === 'boss' ? await positionPayload(demo) : undefined;
      await battleApi.join(id, joinPet, joinTeam || undefined, pos);
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setJoining(false);
    }
  };
  const start = async () => {
    try {
      await battleApi.start(id);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (!detail) return <AppShell><p className="text-sm text-muted-foreground">{error || 'Načítám souboj…'}</p></AppShell>;
  const group = detail.size > 2;

  if (!detail.is_participant) {
    const host = detail.fighters.find((f) => f.slot === 'a');
    return (
      <AppShell>
        <h1 className="text-2xl font-extrabold">{group ? MODE_LABEL[detail.mode] : 'Výzva na souboj'}</h1>
        {group ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href={`/u/${encodeURIComponent(detail.challenger)}`} className="font-semibold text-foreground underline">{detail.challenger}</Link> svolává
              {detail.mode === 'ffa' ? ' souboj tří hráčů, každý za sebe. Vyhrává poslední, kdo zůstane stát.'
                : detail.mode === 'boss' ? ` partu na bosse u místa ${detail.boss?.place_name}. Přidat se můžeš jen na místě (do 300 m) a s tímhle bosem jednou za týden.`
                : ' souboj dvou dvojic. Vyhrává tým.'}
            </p>
            <Lobby s={detail} />
          </>
        ) : host && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <PetArt type={host.type} type2={host.type2 || ''} seed={host.seed} stage={host.stage} rarity={host.rarity} size={72} />
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground"><Link href={`/u/${encodeURIComponent(detail.challenger)}`} className="font-semibold text-foreground underline">{detail.challenger}</Link> tě vyzývá</div>
              <div className="truncate text-lg font-bold">{host.name}</div>
              <div className="text-xs text-muted-foreground">{PET_TYPE[host.type].label}, lvl {host.level}</div>
            </div>
          </div>
        )}
        {detail.joinable ? (
          <>
            {detail.free_teams.length > 0 && (
              <div className="mt-4" role="radiogroup" aria-label="Tým">
                <p className="font-semibold">Za koho hraješ?</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {detail.free_teams.map((t) => (
                    <button key={t} role="radio" aria-checked={joinTeam === t} onClick={() => setJoinTeam(t)}
                      className={cn('flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 font-semibold', joinTeam === t ? 'border-primary bg-primary/10' : 'border-border')}>
                      <span className={cn('h-3 w-3 rounded-full', TEAM_COLOR[t])} /> {TEAM_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-4 font-semibold">Koho pošleš?</p>
            {myPets.length ? <PetPicker pets={myPets} value={joinPet} onChange={setJoinPet} /> : <p className="mt-2 text-sm">Nejdřív potřebuješ tvora z razítka.</p>}
            <Button size="lg" className="mt-3 w-full" onClick={() => join()} isLoading={joining} disabled={!joinPet}>
              {detail.mode === 'boss' && <MapPin className="h-5 w-5" />}{detail.mode === 'boss' ? 'Přidat se k partě (jsem tady)' : group ? 'Přidat se' : 'Přijmout souboj'}
            </Button>
            {detail.mode === 'boss' && user?.is_staff && (
              <button onClick={() => join(true)} disabled={joining || !joinPet} className="mt-2 w-full text-sm text-muted-foreground underline">Demo připojení bez kontroly vzdálenosti</button>
            )}
          </>
        ) : <p className="mt-3 text-sm text-muted-foreground">{detail.invited && detail.status === 'waiting' ? 'Tahle výzva patří jinému hráči.' : 'Tenhle souboj už není volný.'}</p>}
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </AppShell>
    );
  }

  const s = state;
  const me = s?.fighters.find((f) => f.me);
  const secs = s?.deadline ? Math.max(0, Math.ceil((new Date(s.deadline).getTime() - now) / 1000)) : null;
  const missing = s ? s.size - s.fighters.length : 0;
  const party = s?.fighters.filter((f) => !f.boss).length ?? 0;

  return (
    <AppShell>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">{detail.mode === 'boss' && <Crown className="h-3.5 w-3.5 text-amber-500" aria-hidden />}{MODE_LABEL[detail.mode]}{s?.boss && `, ${s.boss.place_name}`}{s?.is_bot && detail.mode === 'practice' && ', soupeř je strážce místa'}</span>
        <span>{status === 'connected' ? 'online' : status === 'connecting' ? 'připojuji…' : 'odpojeno, zkouším znovu'}</span>
      </div>

      {s?.status === 'waiting' && (
        <div className="mt-6 text-center">
          <div className="text-lg font-bold">
            {detail.mode === 'ranked' ? 'Hledám soupeře…' : detail.mode === 'boss' ? `Parta na bosse: ${party} ze 3` : group ? `${MODE_LABEL[detail.mode]}: chybí ${missing} ${missing === 1 ? 'hráč' : 'hráči'}` : detail.invited ? `Výzva odeslána hráči ${detail.invited}` : 'Vyzvi kamaráda'}
          </div>
          {detail.mode !== 'ranked' && (
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.mode === 'boss' ? (detail.is_host ? 'Kamarádi, kteří jsou s tebou na místě, se přidají přes QR kód. Pak souboj spusť.' : `Souboj spustí ${detail.challenger}.`)
                : group ? 'Souboj začne, jakmile se zaplní všechna místa.' : detail.invited ? 'Uvidí ji v Souboji. Jakmile ji přijme, začnete.' : 'Souboj začne, jakmile se kamarád připojí.'}
            </p>
          )}
          {group && <Lobby s={s} />}
          {detail.mode === 'boss' && detail.is_host && (
            <Button size="lg" className="mt-4 w-full bg-amber-400 text-[#3b0d0d] hover:bg-amber-300" onClick={start}>
              <Play className="h-5 w-5" /> {party > 1 ? `Začít souboj (${party} hráči)` : 'Začít souboj sám'}
            </Button>
          )}
          {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
          {detail.mode !== 'ranked' && url && (
            <ShareQr className="mt-5" url={url} title={`${MODE_LABEL[detail.mode]}, Západ GO`}
              hint={detail.mode === 'boss' ? 'Kamarádi naskenují QR kód a přidají se. Taky musí být do 300 m od místa.' : group ? 'Jste spolu? Ať ostatní naskenují QR kód a hned se přidají. Nebo jim pošli odkaz.' : 'Jste spolu? Ať kamarád naskenuje QR kód telefonem. Nebo mu pošli odkaz.'} />
          )}
          <div className="mx-auto mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden /> Čekám na {detail.mode === 'boss' ? 'partu' : group ? 'hráče' : 'soupeře'}…
          </div>
          {detail.mode === 'ranked' && (
            <p className="mt-4 text-sm text-muted-foreground">Nikdo zrovna nehraje? <Link href="/battle" className="text-primary underline">Zkus trénink proti strážci</Link>.</p>
          )}
        </div>
      )}

      {s && s.status !== 'waiting' && s.fighters.length >= 2 && (
        <div className="mt-2">
          <Arena fighters={s.fighters} results={results} onBusy={setAnimating} reserve={s.reserve} />
          {s.status === 'active' && (
            <div className="mt-2 flex items-center justify-between text-sm font-semibold">
              <span>Tah {s.turn}{group && s.waiting_for.length > 0 && !s.waiting_for_you && <span className="font-normal text-muted-foreground">, čeká se na: {s.waiting_for.join(', ')}</span>}</span>
              <span className={cn('tabular-nums', secs != null && secs <= 5 && 'text-destructive')}>{secs ?? '–'} s</span>
            </div>
          )}
        </div>
      )}

      {oppGone && !end && <p className="mt-2 rounded-lg bg-amber-500/15 p-2 text-center text-xs">Někdo se odpojil. Když se nevrátí, server za něj hraje Útok.</p>}

      {s?.status === 'active' && !end && me && me.hp <= 0 && (
        <p className="mt-3 rounded-xl bg-muted p-3 text-center text-sm">Tvůj tvor padl. Dívej se, jak to dopadne{detail.mode === 'team' ? ', tvůj parťák bojuje dál' : ''}.</p>
      )}

      {s?.status === 'active' && !end && s.moves && me && me.hp > 0 && (
        picked ? (
          <div className="mt-2 rounded-2xl border-2 border-trail-yellow/70 bg-card p-3">
            <p className="flex items-center gap-2 text-sm font-semibold"><Crosshair className="h-4 w-4 text-trail-red" aria-hidden /> Na koho {picked.name}?</p>
            <div className="mt-2 grid gap-2">
              {enemies.map((f: BattleFighter) => (
                <button key={f.slot} onClick={() => move(picked, f.slot)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-2 text-left hover:bg-accent">
                  <PetArt type={f.type} type2={f.type2 || ''} seed={f.seed} stage={f.stage} rarity={f.rarity} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{f.name}</span>
                    <span className="block text-xs text-muted-foreground">{f.owner ?? 'strážce'} · {Math.round((100 * f.hp) / f.max_hp)} % HP{s.mode === 'team' ? ` · ${TEAM_LABEL[f.team]}` : ''}</span>
                  </span>
                  <span className="h-2 w-16 overflow-hidden rounded-full bg-muted"><span className="block h-2 rounded-full bg-red-500" style={{ width: `${(100 * f.hp) / f.max_hp}%` }} /></span>
                </button>
              ))}
            </div>
            <button onClick={() => setPicked(null)} className="mt-2 text-sm font-semibold text-muted-foreground underline">Zpět na útoky</button>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {s.moves.map((m) => (
              <MoveButton key={m.id} m={m} sp={me.sp ?? 0} disabled={!s.waiting_for_you || animating} onClick={() => move(m)} />
            ))}
            {!s.waiting_for_you && !animating && <p className="col-span-2 text-center text-xs text-muted-foreground">Čekám na {group ? 'ostatní' : 'soupeře'}…</p>}
          </div>
        )
      )}

      {lines.length > 0 && (
        <details className="mt-4 rounded-xl bg-muted p-3 text-xs">
          <summary className="cursor-pointer font-semibold">Průběh souboje</summary>
          <ol className="mt-2 space-y-0.5">
            {lines.map((l, i) => <li key={i} className={cn(i === 0 && 'font-semibold')}>{l}</li>)}
          </ol>
        </details>
      )}

      {showEnd && end && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label="Konec souboje">
          <div className="hop-in my-auto w-full max-w-xs rounded-3xl bg-background p-6 text-center">
            {(() => { const I = end.winner === 'you' ? Trophy : end.winner === 'draw' ? Handshake : Moon; return <I className="mx-auto h-12 w-12 text-trail-yellow" aria-hidden />; })()}
            <div className="mt-2 text-2xl font-black">
              {end.winner === 'you' ? (detail.mode === 'boss' ? 'Boss poražen!' : 'Vítězství!') : end.winner === 'draw' ? 'Remíza' : 'Prohra'}
            </div>
            {group && end.winner !== 'draw' && <div className="mt-1 text-sm">Vyhráli: <b>{end.winners.join(', ')}</b></div>}
            <div className="mt-1 text-sm text-muted-foreground">
              Ty +{end.player_xp} XP{end.pets.length <= 1 && `, tvůj tvor +${end.xp} XP`}{end.rating_delta ? `, hodnocení ${end.rating_delta > 0 ? '+' : ''}${end.rating_delta}` : ''}
            </div>
            {end.pets.length > 1 && (
              <ul className="mt-3 space-y-1 rounded-xl bg-muted p-2 text-left text-sm" aria-label="XP pro sestavu podle zranění">
                {end.pets.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate"><b>{p.name}</b> <span className="text-xs text-muted-foreground">zranění {p.damage}</span></span>
                    <span className="shrink-0 tabular-nums">+{p.xp} XP{p.injured && ' 🩹'}{p.level_up && ` · lvl ${p.level_up}`}</span>
                  </li>
                ))}
              </ul>
            )}
            {end.reward?.pet && (
              <div className="mt-4 text-left">
                <div className="mb-2 text-center font-hand text-xl text-primary">Trofej: legendární tvor!</div>
                <PetCard pet={end.reward.pet} />
              </div>
            )}
            {!!end.reward?.badges.length && (
              <div className="mt-3 rounded-xl bg-trail-yellow/25 py-2 text-sm font-bold">Nový odznak: {end.reward.badges.map((b) => `${b.icon} ${b.name}`).join(', ')}</div>
            )}
            {end.level_up && <div className="mt-3 rounded-xl bg-trail-yellow/25 py-2 text-sm font-bold">Level up! Tvůj tvor je teď na levelu {end.level_up}.</div>}
            {end.can_evolve && <div className="mt-2 rounded-xl bg-primary/15 py-2 text-sm font-bold text-primary">✦ Tvůj tvor je připravený na evoluci!</div>}
            {end.injured_until && (
              <div className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-destructive/10 py-2 text-sm font-semibold text-destructive">
                <Bandage className="h-4 w-4" aria-hidden /> {end.pets.filter((p) => p.injured).length > 1 ? 'Padlí tvorové se 30 min léčí' : 'Tvor je zraněný, 30 min se léčí'}
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href={detail.mode === 'boss' ? '/map' : '/battle'} className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">{detail.mode === 'boss' ? 'Na mapu' : 'Znovu'}</Link>
              <Link href="/pets" className="rounded-xl bg-muted py-2.5 text-sm font-semibold">{end.can_evolve ? 'Evolvovat' : 'Tvorové'}</Link>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
