'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bandage, Handshake, Hammer, Moon, Shield, Sparkles, Sword, Trophy, Zap } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Arena } from '@/components/battle/Arena';
import { PetPicker } from '@/components/battle/PetPicker';
import { PetArt } from '@/components/pet/PetCard';
import { ShareQr } from '@/components/ui/share-qr';
import { Button } from '@/components/ui/button';
import { useWebSocket, type WsMessage } from '@/hooks/useWebSocket';
import {
  battleApi, errorMessage, gameApi,
  type BattleDetail, type BattleEnd, type BattleState, type MoveInfo, type Pet, type TurnResult,
} from '@/lib/api';
import { PET_TYPE } from '@/lib/game';
import { ELEMENT_GLOW } from '@/lib/petArt';
import { cn } from '@/lib/utils';

function describe(r: TurnResult, you: string, opp: string) {
  return r.events.map((e) => {
    const who = e.actor === 'you' ? you : opp;
    if (e.kind === 'guard') return `${who}: ${e.name}${e.heal ? `, +${e.heal} HP` : ''}.`;
    if (!e.damage && e.heal) return `${who}: ${e.name}, +${e.heal} HP.`;
    if (!e.hit) return `${who}: ${e.name}, vedle!`;
    const eff = e.effectiveness === 1.5 ? ' Velmi účinné!' : e.effectiveness === 0.75 ? ' Málo účinné.' : '';
    return `${who}: ${e.name} za ${e.damage}${e.crit ? ' (kritický zásah)' : ''}.${eff}${e.heal ? ` Vysál +${e.heal} HP.` : ''}`;
  });
}

const MOVE_ICON = { attack: Sword, heavy: Hammer, guard: Shield } as Record<string, typeof Sword>;

function MoveButton({ m, sp, disabled, onClick }: { m: MoveInfo; sp: number; disabled: boolean; onClick: () => void }) {
  const Icon = MOVE_ICON[m.id] ?? (m.kind === 'guard' ? Shield : Sparkles);
  const broke = sp < m.cost;
  const t = m.type ?? 'fortress';
  const magic = m.kind === 'magic' || m.id === 'bastion';
  const hint = m.power ? `síla ${m.power}${m.acc < 1 ? ` · ${Math.round(m.acc * 100)} %` : ''}` : m.heal ? `léčí ${Math.round(m.heal * 100)} %` : '½ zranění';
  return (
    <button onClick={onClick} disabled={disabled || broke} aria-label={`${m.name}, ${hint}, výdrž ${m.cost}`}
      className={cn('relative flex min-h-16 cursor-pointer flex-col items-start justify-center overflow-hidden rounded-2xl border-b-4 px-3 py-2 text-left text-white transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40',
        !magic && (m.kind === 'guard' ? 'border-sky-900 bg-sky-700' : 'border-[#1d2a22] bg-[#2e3d34]'))}
      style={magic ? { background: `linear-gradient(135deg, ${PET_TYPE[t].color}, color-mix(in oklab, ${ELEMENT_GLOW[t]} 55%, ${PET_TYPE[t].color}))`, borderColor: 'rgb(0 0 0 / 0.35)' } : undefined}>
      <span className="flex items-center gap-1.5 text-sm font-bold leading-tight"><Icon className="h-4 w-4 shrink-0" aria-hidden />{m.name}</span>
      <span className="mt-0.5 flex w-full items-center justify-between text-[11px] opacity-85">
        <span>{hint}</span>
        <span className={cn('flex items-center gap-0.5 font-semibold', broke && 'text-red-200')}><Zap className="h-3 w-3" aria-hidden />{m.cost}</span>
      </span>
    </button>
  );
}

export default function BattlePage() {
  const { id } = useParams<{ id: string }>();
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
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const names = useRef({ you: 'Ty', opp: 'Soupeř' });

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
      names.current = { you: st.you?.name ?? 'Ty', opp: st.opp?.name ?? 'Soupeř' };
      setState(st);
    } else if (m.type === 'turn_result') {
      const r = m as unknown as TurnResult;
      setOppGone(false);
      setResults((prev) => [...prev, r]);
      const ls = describe(r, names.current.you, names.current.opp).map((l) => `${r.turn}. ${l}`);
      setLines((prev) => [...ls.reverse(), ...prev].slice(0, 30));
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

  const move = (mv: string) => {
    if (!state?.turn) return;
    send({ type: 'move', turn: state.turn, move: mv });
    setState({ ...state, waiting_for_you: false });
  };

  const join = async () => {
    if (!joinPet) return;
    try {
      await battleApi.join(id, joinPet);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- adresa až po hydrataci
  useEffect(() => setUrl(window.location.href.split('?')[0]), []);

  if (!detail) return <AppShell><p className="text-sm text-muted-foreground">{error || 'Načítám souboj…'}</p></AppShell>;

  if (!detail.is_participant) {
    return (
      <AppShell>
        <h1 className="text-2xl font-extrabold">Výzva na souboj</h1>
        {detail.you && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <PetArt type={detail.you.type} seed={detail.you.seed} stage={detail.you.stage} rarity={detail.you.rarity} size={72} />
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground"><Link href={`/u/${encodeURIComponent(detail.challenger)}`} className="font-semibold text-foreground underline">{detail.challenger}</Link> tě vyzývá</div>
              <div className="truncate text-lg font-bold">{detail.you.name}</div>
              <div className="text-xs text-muted-foreground">{PET_TYPE[detail.you.type].label}, lvl {detail.you.level}</div>
            </div>
          </div>
        )}
        {detail.joinable ? (
          <>
            <p className="mt-4 font-semibold">Koho pošleš proti?</p>
            {myPets.length ? <PetPicker pets={myPets} value={joinPet} onChange={setJoinPet} /> : <p className="mt-2 text-sm">Nejdřív potřebuješ tvora z razítka.</p>}
            <Button size="lg" className="mt-3 w-full" onClick={join} disabled={!joinPet}>Přijmout souboj</Button>
          </>
        ) : <p className="mt-3 text-sm text-muted-foreground">{detail.invited && detail.status === 'waiting' ? 'Tahle výzva patří jinému hráči.' : 'Tenhle souboj už není volný.'}</p>}
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </AppShell>
    );
  }

  const s = state;
  const secs = s?.deadline ? Math.max(0, Math.ceil((new Date(s.deadline).getTime() - now) / 1000)) : null;

  return (
    <AppShell>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{{ ranked: 'Hodnocený souboj', friendly: 'Přátelský souboj', practice: 'Trénink' }[detail.mode]}{s?.is_bot && ', soupeř je strážce místa'}</span>
        <span>{status === 'connected' ? 'online' : status === 'connecting' ? 'připojuji…' : 'odpojeno, zkouším znovu'}</span>
      </div>

      {s?.status === 'waiting' && (
        <div className="mt-6 text-center">
          <div className="text-lg font-bold">
            {detail.mode !== 'friendly' ? 'Hledám soupeře…' : detail.invited ? `Výzva odeslána hráči ${detail.invited}` : 'Vyzvi kamaráda'}
          </div>
          {detail.mode === 'friendly' && (
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.invited ? 'Uvidí ji v Souboji. Jakmile ji přijme, začnete.' : 'Souboj začne, jakmile se kamarád připojí.'}
            </p>
          )}
          {detail.mode === 'friendly' && url && (
            <ShareQr className="mt-5" url={url} title="Výzva na souboj, Západ GO"
              hint={detail.invited ? 'Jste spolu? Ať naskenuje QR kód a hned se připojí.' : 'Jste spolu? Ať kamarád naskenuje QR kód telefonem. Nebo mu pošli odkaz.'} />
          )}
          <div className="mx-auto mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden /> Čekám na soupeře…
          </div>
          {detail.mode === 'ranked' && (
            <p className="mt-4 text-sm text-muted-foreground">Nikdo zrovna nehraje? <Link href="/battle" className="text-primary underline">Zkus trénink proti strážci</Link>.</p>
          )}
        </div>
      )}

      {s?.you && s.opp && (
        <div className="mt-2">
          <Arena you={s.you} opp={s.opp} results={results} onBusy={setAnimating} />
          {s.status === 'active' && (
            <div className="mt-2 flex items-center justify-between text-sm font-semibold">
              <span>Tah {s.turn}</span>
              <span className={cn('tabular-nums', secs != null && secs <= 5 && 'text-destructive')}>{secs ?? '–'} s</span>
            </div>
          )}
        </div>
      )}

      {oppGone && !end && <p className="mt-2 rounded-lg bg-amber-500/15 p-2 text-center text-xs">Soupeř se odpojil. Když se nevrátí, server za něj hraje Útok.</p>}

      {s?.status === 'active' && !end && s.you?.moves && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {s.you.moves.map((m) => (
            <MoveButton key={m.id} m={m} sp={s.you!.sp} disabled={!s.waiting_for_you || animating} onClick={() => move(m.id)} />
          ))}
          {!s.waiting_for_you && !animating && <p className="col-span-2 text-center text-xs text-muted-foreground">Čekám na soupeře…</p>}
        </div>
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
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label="Konec souboje">
          <div className="hop-in w-full max-w-xs rounded-3xl bg-background p-6 text-center">
            {(() => { const I = end.winner === 'you' ? Trophy : end.winner === 'draw' ? Handshake : Moon; return <I className="mx-auto h-12 w-12 text-trail-yellow" aria-hidden />; })()}
            <div className="mt-2 text-2xl font-black">{end.winner === 'you' ? 'Vítězství!' : end.winner === 'draw' ? 'Remíza' : 'Prohra'}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Tvůj tvor +{end.xp} XP{end.rating_delta ? `, hodnocení ${end.rating_delta > 0 ? '+' : ''}${end.rating_delta}` : ''}
            </div>
            {end.level_up && <div className="mt-3 rounded-xl bg-trail-yellow/25 py-2 text-sm font-bold">Level up! Tvůj tvor je teď na levelu {end.level_up}.</div>}
            {end.can_evolve && <div className="mt-2 rounded-xl bg-primary/15 py-2 text-sm font-bold text-primary">✦ Tvůj tvor je připravený na evoluci!</div>}
            {end.injured_until && (
              <div className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-destructive/10 py-2 text-sm font-semibold text-destructive">
                <Bandage className="h-4 w-4" aria-hidden /> Tvor je zraněný, 30 min se léčí
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href="/battle" className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">Znovu</Link>
              <Link href="/pets" className="rounded-xl bg-muted py-2.5 text-sm font-semibold">{end.can_evolve ? 'Evolvovat' : 'Tvorové'}</Link>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
