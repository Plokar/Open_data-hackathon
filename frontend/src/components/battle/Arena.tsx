'use client';

import { useEffect, useRef, useState } from 'react';
import { Crown } from 'lucide-react';
import type { BattleFighter, StatusId, TurnResult } from '@/lib/api';
import type { BattleScene } from '@/lib/battleFx';
import { PET_TYPE, STATUS } from '@/lib/game';
import { cn } from '@/lib/utils';

type Bars = Record<string, { hp: number; sp: number }>;
const bars = (fs: BattleFighter[]): Bars => Object.fromEntries(fs.map((f) => [f.slot, { hp: f.hp, sp: f.sp ?? 0 }]));
const TEAM_COLOR: Record<string, string> = { red: '#e0574f', blue: '#4f8de0' };

function Hud({ f, v, compact, bench = [] }: { f: BattleFighter; v: { hp: number; sp: number }; compact: boolean; bench?: { name: string }[] }) {
  const pct = Math.max(0, Math.min(100, (100 * v.hp) / f.max_hp));
  const sp = Math.max(0, Math.min(100, (100 * v.sp) / (f.max_sp || 1)));
  const dead = v.hp <= 0;
  return (
    <div className={cn('rounded-xl border bg-[#11131c]/80 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-sm transition-opacity',
      f.boss ? 'border-red-400/60' : 'border-white/15', dead && 'opacity-45')}
      style={TEAM_COLOR[f.team] ? { borderLeft: `4px solid ${TEAM_COLOR[f.team]}` } : undefined}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn('flex min-w-0 items-center gap-1 truncate font-bold', compact ? 'text-[11px]' : 'text-[13px]')}>
          {f.boss && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Boss" />}
          <span className="truncate">{f.name.replace(/^Strážce: /, '')}</span>
        </span>
        <span className="shrink-0 text-[10px] font-semibold opacity-80">{f.boss ? 'BOSS' : `Lv ${f.level ?? 1}`}</span>
      </div>
      {f.owner && !f.me && <div className="-mt-0.5 truncate text-[10px] opacity-70">{f.owner}</div>}
      <div className="mt-1 flex items-center gap-1.5">
        <span className="rounded px-1 text-[9px] font-black leading-4" style={{ background: PET_TYPE[f.type].color }}>HP</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/50" role="progressbar" aria-valuenow={v.hp} aria-valuemin={0} aria-valuemax={f.max_hp} aria-label={`Životy: ${f.name}`}>
          <div className={cn('h-full rounded-full transition-[width,background-color] duration-700 ease-out', pct > 50 ? 'bg-emerald-400' : pct > 20 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {Object.keys(f.status ?? {}).length > 0 && !dead && (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {(Object.entries(f.status ?? {}) as [StatusId, number][]).map(([id, n]) => {
            const st = STATUS[id];
            return (
              <span key={id} title={`${st.label}: ${st.text}`} aria-label={`${st.label}, ještě ${n} ${n === 1 ? 'tah' : n < 5 ? 'tahy' : 'tahů'}: ${st.text}`}
                className="flex items-center gap-0.5 rounded px-1 text-[9px] font-bold leading-4" style={{ background: st.color }}>
                <st.Icon className="h-2.5 w-2.5" aria-hidden />{!compact && st.label} {n}
              </span>
            );
          })}
        </div>
      )}
      {f.me && (
        <>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="rounded bg-sky-500 px-1 text-[9px] font-black leading-4">SP</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/50" role="progressbar" aria-valuenow={v.sp} aria-valuemin={0} aria-valuemax={f.max_sp} aria-label="Výdrž">
              <div className="h-full rounded-full bg-sky-400 transition-[width] duration-500" style={{ width: `${sp}%` }} />
            </div>
          </div>
          {!compact && <div className="mt-0.5 text-right text-[11px] tabular-nums opacity-90">{Math.max(0, v.hp)} / {f.max_hp}</div>}
        </>
      )}
      {bench.length > 0 && <div className="mt-0.5 truncate text-[10px] opacity-75">Střídačka: {bench.map((x) => x.name).join(', ')}</div>}
    </div>
  );
}

/** Aréna: Pixi scéna (lib/battleFx) + HUD v DOM. Výsledky tahů přehrává postupně, pruhy hýbe až animace. */
export function Arena({ fighters, results, onBusy, reserve = {} }: {
  fighters: BattleFighter[]; results: TurnResult[]; onBusy: (busy: boolean) => void; reserve?: Record<string, { name: string }[]>;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<BattleScene | null>(null);
  const [busy, setBusy] = useState(false);
  const [disp, setDisp] = useState<Bars>(() => bars(fighters));
  // HUD ukazuje bojovníky podle animace (u sestavy se jméno změní až při střídání, ne hned se stavem ze serveru)
  const [shown, setShown] = useState(fighters);
  const [say, setSay] = useState('');
  const played = useRef(results.length);
  const running = useRef(false);
  const dispRef = useRef(disp);
  const onBusyRef = useRef(onBusy);
  useEffect(() => {
    dispRef.current = disp;
    onBusyRef.current = onBusy;
  });

  // Pixi scéna jednou za souboj (StrictMode ji stihne zrušit uprostřed initu, proto `cancelled`)
  useEffect(() => {
    let cancelled = false, s: BattleScene | null = null;
    import('@/lib/battleFx').then(({ BattleScene }) => BattleScene.create(el.current!, fighters)).then((x) => {
      if (cancelled) x.destroy();
      else { s = x; setScene(x); }
    });
    return () => { cancelled = true; s?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scéna se staví jen z počátečních bojovníků
  }, []);

  // Mimo animaci drží pruhy pravdu ze serveru. Nový stav chodí hned po výsledku tahu,
  // takže dokud čeká nepřehraný tah, pruhy zůstávají na stavu před ním.
  useEffect(() => {
    if (busy || played.current < results.length) return;
    setDisp(bars(fighters));
    setShown(fighters);
  }, [busy, fighters, results]);

  useEffect(() => {
    if (!scene || running.current || played.current >= results.length) return;
    running.current = true;
    setBusy(true);
    onBusyRef.current(true);
    (async () => {
      while (played.current < results.length) {
        const r = results[played.current++];
        const hp = Object.fromEntries(Object.entries(dispRef.current).map(([k, x]) => [k, x.hp]));
        for (const e of r.events) {
          await scene.play(e, hp, {
            say: setSay,
            change: (slot, d) => setDisp((v) => v[slot] ? { ...v, [slot]: { hp: v[slot].hp + (d.hp ?? 0), sp: v[slot].sp + (d.sp ?? 0) } } : v),
            swap: (slot, nf) => {
              setShown((cur) => cur.map((x) => (x.slot === slot ? { ...nf, slot, me: x.me, ally: x.ally } : x)));
              setDisp((v) => ({ ...v, [slot]: { hp: nf.hp, sp: nf.sp ?? 0 } }));
            },
          });
        }
      }
      running.current = false;
      setBusy(false);
      setSay('');
      onBusyRef.current(false);
    })();
  }, [scene, results]);

  const enemies = shown.filter((f) => !f.ally && !f.me);
  const mine = [...shown.filter((f) => f.me), ...shown.filter((f) => f.ally && !f.me)];
  const benchOf = (f: BattleFighter) => reserve[f.slot] ?? []; // sestava na bosse: kdo ještě nenastoupil
  const compact = fighters.length > 2;
  const v = (f: BattleFighter) => disp[f.slot] ?? { hp: f.hp, sp: f.sp ?? 0 };

  // 1v1: HUD přes arénu jako v Pokémonech. Skupinové souboje: pruhy nad a pod arénou, ať nezakrývají tvory.
  const row = (fs: BattleFighter[]) => (
    <div className={cn('-mx-4 grid gap-1 bg-[#0b0e16] px-2 py-1.5 sm:mx-0', fs.length > 2 ? 'grid-cols-3' : fs.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
      {fs.map((f) => <Hud key={f.slot} f={f} v={v(f)} compact bench={benchOf(f)} />)}
    </div>
  );
  return (
    <div>
      {compact && <div className="overflow-hidden sm:rounded-t-2xl">{row(enemies)}</div>}
      <div className={cn('relative -mx-4 overflow-hidden bg-[#0b0e16] sm:mx-0', !compact && 'sm:rounded-2xl')} style={{ aspectRatio: '480 / 340' }}>
        <div ref={el} className="absolute inset-0" />
        {!scene && <div className="absolute inset-0 grid place-items-center text-sm text-white/70">Připravuji arénu…</div>}
        {!compact && (
          <>
            <div className="absolute left-[3%] top-[4%] w-[46%]">{enemies.map((f) => <Hud key={f.slot} f={f} v={v(f)} compact={false} />)}</div>
            <div className="absolute bottom-[4%] right-[3%] w-[46%]">{mine.map((f) => <Hud key={f.slot} f={f} v={v(f)} compact={false} bench={benchOf(f)} />)}</div>
          </>
        )}
      </div>
      {compact && row(mine)}
      <div className="-mx-4 min-h-14 border-y-4 border-[#2a2f45] bg-[#141826] px-4 py-3 text-[15px] font-semibold leading-snug text-white sm:mx-0 sm:rounded-b-2xl" aria-live="polite">
        {say || (busy ? '…' : 'Co udělá tvůj tvor?')}
      </div>
    </div>
  );
}
