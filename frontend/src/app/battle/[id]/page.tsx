'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Hammer, Shield, Sword } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PetPicker } from '@/components/battle/PetPicker';
import { PetArt } from '@/components/pet/PetCard';
import { Button } from '@/components/ui/button';
import { useWebSocket, type WsMessage } from '@/hooks/useWebSocket';
import {
  battleApi, errorMessage, gameApi,
  type BattleDetail, type BattleEnd, type BattleFighter, type BattleState, type Move, type Pet, type TurnResult,
} from '@/lib/api';
import { PET_TYPE } from '@/lib/game';
import { cn } from '@/lib/utils';

const MOVE_LABEL: Record<Move, string> = { attack: 'Útok', heavy: 'Silný úder', guard: 'Obrana' };

function describe(r: TurnResult, you: string, opp: string) {
  return r.events.map((e) => {
    const who = e.actor === 'you' ? you : opp;
    if (e.move === 'guard') return `${who} se brání${e.heal ? ` a léčí +${e.heal} HP` : ''}.`;
    if (!e.hit) return `${who}: ${MOVE_LABEL[e.move]} – vedle!`;
    const eff = e.effectiveness === 1.5 ? ' Velmi účinné!' : e.effectiveness === 0.75 ? ' Málo účinné.' : '';
    return `${who}: ${MOVE_LABEL[e.move]} za ${e.damage}.${eff}`;
  });
}

function Fighter({ f, label, hit }: { f: BattleFighter; label: string; hit: boolean }) {
  const pct = Math.round((100 * f.hp) / f.max_hp);
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <div className={cn('transition-transform', hit && 'animate-[shake_0.4s]')}>
          <PetArt type={f.type} seed={f.seed} size={64} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-muted-foreground">{label} · {PET_TYPE[f.type].label}{f.guard && ' · 🛡️ brání se'}</div>
          <div className="truncate font-bold">{f.name}</div>
          <div className="mt-1 h-3 rounded-full bg-muted" role="progressbar" aria-valuenow={f.hp} aria-valuemin={0} aria-valuemax={f.max_hp} aria-label={`HP ${label}`}>
            <div className={cn('h-3 rounded-full transition-all duration-500', pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-0.5 text-xs tabular-nums">{f.hp} / {f.max_hp} HP</div>
        </div>
      </div>
    </div>
  );
}

export default function BattlePage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<BattleDetail | null>(null);
  const [state, setState] = useState<BattleState | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [end, setEnd] = useState<BattleEnd | null>(null);
  const [oppGone, setOppGone] = useState(false);
  const [hit, setHit] = useState<'you' | 'opp' | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [myPets, setMyPets] = useState<Pet[]>([]);
  const [joinPet, setJoinPet] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
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
      const ls = describe(r, names.current.you, names.current.opp).map((l) => `${r.turn}. ${l}`);
      setLines((prev) => [...ls.reverse(), ...prev].slice(0, 30));
      const dmg = r.events.filter((e) => e.hit && e.damage);
      setHit(dmg.length ? (dmg[dmg.length - 1].actor === 'you' ? 'opp' : 'you') : null);
      setTimeout(() => setHit(null), 450);
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

  useEffect(() => {
    if (state?.status !== 'active') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [state?.status]);

  const move = (mv: Move) => {
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

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: 'Výzva na souboj – ZÁPAD GO', url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    }
  };

  if (!detail) return <AppShell><p className="text-sm text-muted-foreground">{error || 'Načítám souboj…'}</p></AppShell>;

  if (!detail.is_participant) {
    return (
      <AppShell>
        <h1 className="text-2xl font-extrabold">Výzva na souboj</h1>
        {detail.joinable ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">{detail.you?.name} tě vyzývá. Vyber PETa:</p>
            {myPets.length ? <PetPicker pets={myPets} value={joinPet} onChange={setJoinPet} /> : <p className="mt-2 text-sm">Nejdřív potřebuješ PETa z razítka.</p>}
            <Button size="lg" className="mt-3 w-full" onClick={join} disabled={!joinPet}>Přijmout souboj</Button>
          </>
        ) : <p className="mt-2 text-sm text-muted-foreground">Tenhle souboj už není volný.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </AppShell>
    );
  }

  const s = state;
  const secs = s?.deadline ? Math.max(0, Math.ceil((new Date(s.deadline).getTime() - now) / 1000)) : null;

  return (
    <AppShell>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{{ ranked: 'Hodnocený souboj', friendly: 'Přátelský souboj', practice: 'Trénink' }[detail.mode]}{s?.is_bot && ' · soupeř je bot'}</span>
        <span>{status === 'connected' ? '● online' : status === 'connecting' ? 'připojuji…' : '○ odpojeno, zkouším znovu'}</span>
      </div>

      {s?.status === 'waiting' && (
        <div className="mt-6 text-center">
          <div className="text-lg font-bold">{detail.mode === 'friendly' ? 'Pošli odkaz kamarádovi' : 'Hledám soupeře…'}</div>
          <div className="mx-auto mt-3 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden />
          {detail.mode === 'friendly' && <Button className="mt-4" onClick={share}>{copied ? 'Odkaz zkopírován ✓' : 'Sdílet odkaz'}</Button>}
          {detail.mode === 'ranked' && (
            <p className="mt-4 text-sm text-muted-foreground">Nikdo zrovna nehraje? <Link href="/battle" className="text-primary underline">Zkus trénink proti botovi</Link>.</p>
          )}
        </div>
      )}

      {s?.you && s.opp && (
        <div className="mt-3 space-y-2">
          <Fighter f={s.opp} label={s.is_bot ? 'Soupeř (bot)' : 'Soupeř'} hit={hit === 'opp'} />
          <div className="text-center text-sm font-semibold">
            {s.status === 'active' ? <>Tah {s.turn} · <span className={cn(secs != null && secs <= 5 && 'text-destructive')}>{secs ?? '–'} s</span></> : null}
          </div>
          <Fighter f={s.you} label="Ty" hit={hit === 'you'} />
        </div>
      )}

      {oppGone && !end && <p className="mt-2 rounded-lg bg-amber-500/15 p-2 text-center text-xs">Soupeř se odpojil. Když se nevrátí, server za něj hraje Útok.</p>}

      {s?.status === 'active' && !end && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([['attack', Sword, '40 · jistý'], ['heavy', Hammer, '70 · 70 %'], ['guard', Shield, '½ zranění']] as const).map(([mv, Icon, hint]) => (
            <button key={mv} onClick={() => move(mv)} disabled={!s.waiting_for_you} aria-label={`${MOVE_LABEL[mv]} (${hint})`}
              className="flex flex-col items-center gap-1 rounded-2xl bg-primary py-4 font-semibold text-primary-foreground disabled:opacity-40">
              <Icon className="h-6 w-6" aria-hidden />
              <span className="text-sm">{MOVE_LABEL[mv]}</span>
              <span className="text-[10px] opacity-80">{hint}</span>
            </button>
          ))}
          {!s.waiting_for_you && <p className="col-span-3 text-center text-xs text-muted-foreground">Čekám na soupeře…</p>}
        </div>
      )}

      {lines.length > 0 && (
        <ol className="mt-4 space-y-0.5 rounded-xl bg-muted p-3 text-xs" aria-live="polite">
          {lines.map((l, i) => <li key={i} className={cn(i === 0 && 'font-semibold')}>{l}</li>)}
        </ol>
      )}

      {end && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal aria-label="Konec souboje">
          <div className="w-full max-w-xs rounded-3xl bg-background p-6 text-center">
            <div className="text-5xl" aria-hidden>{end.winner === 'you' ? '🏆' : end.winner === 'draw' ? '🤝' : '💤'}</div>
            <div className="mt-2 text-2xl font-black">{end.winner === 'you' ? 'Vítězství!' : end.winner === 'draw' ? 'Remíza' : 'Prohra'}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              PET +{end.xp} XP{end.rating_delta ? ` · hodnocení ${end.rating_delta > 0 ? '+' : ''}${end.rating_delta}` : ''}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href="/battle" className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">Znovu</Link>
              <Link href="/pets" className="rounded-xl bg-muted py-2.5 text-sm font-semibold">PETi</Link>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
