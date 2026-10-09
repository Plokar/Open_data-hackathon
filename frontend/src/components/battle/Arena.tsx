'use client';

import { useEffect, useRef, useState } from 'react';
import type { BattleFighter, TurnResult } from '@/lib/api';
import type { BattleScene } from '@/lib/battleFx';
import { PET_TYPE } from '@/lib/game';
import { cn } from '@/lib/utils';

type Side = 'you' | 'opp';
type Bars = Record<Side, { hp: number; sp: number }>;
const bars = (you: BattleFighter, opp: BattleFighter): Bars => ({ you: { hp: you.hp, sp: you.sp }, opp: { hp: opp.hp, sp: opp.sp } });

function Hud({ f, v, side }: { f: BattleFighter; v: { hp: number; sp: number }; side: Side }) {
  const pct = Math.max(0, Math.min(100, (100 * v.hp) / f.max_hp));
  const sp = Math.max(0, Math.min(100, (100 * v.sp) / (f.max_sp || 1)));
  return (
    <div className={cn('absolute w-[46%] rounded-xl border border-white/15 bg-[#11131c]/80 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-sm',
      side === 'opp' ? 'left-[3%] top-[4%]' : 'bottom-[5%] right-[3%]')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-bold">{f.name.replace(/^Strážce: /, '')}</span>
        <span className="shrink-0 text-[11px] font-semibold opacity-80">Lv {f.level ?? 1}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="rounded px-1 text-[9px] font-black leading-4" style={{ background: PET_TYPE[f.type].color }}>HP</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/50" role="progressbar" aria-valuenow={v.hp} aria-valuemin={0} aria-valuemax={f.max_hp} aria-label={`Životy ${side === 'you' ? 'tvého tvora' : 'soupeře'}`}>
          <div className={cn('h-full rounded-full transition-[width,background-color] duration-700 ease-out', pct > 50 ? 'bg-emerald-400' : pct > 20 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {side === 'you' && (
        <>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="rounded bg-sky-500 px-1 text-[9px] font-black leading-4">SP</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/50" role="progressbar" aria-valuenow={v.sp} aria-valuemin={0} aria-valuemax={f.max_sp} aria-label="Výdrž">
              <div className="h-full rounded-full bg-sky-400 transition-[width] duration-500" style={{ width: `${sp}%` }} />
            </div>
          </div>
          <div className="mt-0.5 text-right text-[11px] tabular-nums opacity-90">{Math.max(0, v.hp)} / {f.max_hp}</div>
        </>
      )}
    </div>
  );
}

/** Aréna: Pixi scéna (lib/battleFx) + HUD v DOM. Výsledky tahů přehrává postupně, pruhy hýbe až animace. */
export function Arena({ you, opp, results, onBusy }: { you: BattleFighter; opp: BattleFighter; results: TurnResult[]; onBusy: (busy: boolean) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<BattleScene | null>(null);
  const [busy, setBusy] = useState(false);
  const [disp, setDisp] = useState<Bars>(() => bars(you, opp));
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
    import('@/lib/battleFx').then(({ BattleScene }) => BattleScene.create(el.current!, you, opp)).then((x) => {
      if (cancelled) x.destroy();
      else { s = x; setScene(x); }
    });
    return () => { cancelled = true; s?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scéna se staví jen z počátečních tvorů
  }, []);

  // Mimo animaci drží pruhy pravdu ze serveru. Nový stav chodí hned po výsledku tahu,
  // takže dokud čeká nepřehraný tah, pruhy zůstávají na stavu před ním.
  useEffect(() => {
    if (!busy && played.current >= results.length) setDisp(bars(you, opp));
  }, [busy, you, opp, results]);

  useEffect(() => {
    if (!scene || running.current || played.current >= results.length) return;
    running.current = true;
    setBusy(true);
    onBusyRef.current(true);
    (async () => {
      while (played.current < results.length) {
        const r = results[played.current++];
        const hp = { you: dispRef.current.you.hp, opp: dispRef.current.opp.hp };
        for (const e of r.events) {
          await scene.play(e, hp, {
            say: setSay,
            change: (side, d) => setDisp((v) => ({ ...v, [side]: { hp: v[side].hp + (d.hp ?? 0), sp: v[side].sp + (d.sp ?? 0) } })),
          });
        }
      }
      running.current = false;
      setBusy(false);
      setSay('');
      onBusyRef.current(false);
    })();
  }, [scene, results]);

  return (
    <div>
      <div className="relative -mx-4 overflow-hidden bg-[#0b0e16] sm:mx-0 sm:rounded-2xl" style={{ aspectRatio: '480 / 340' }}>
        <div ref={el} className="absolute inset-0" />
        {!scene && <div className="absolute inset-0 grid place-items-center text-sm text-white/70">Připravuji arénu…</div>}
        <Hud f={opp} v={disp.opp} side="opp" />
        <Hud f={you} v={disp.you} side="you" />
      </div>
      <div className="-mx-4 min-h-14 border-y-4 border-[#2a2f45] bg-[#141826] px-4 py-3 text-[15px] font-semibold leading-snug text-white sm:mx-0 sm:rounded-b-2xl" aria-live="polite">
        {say || (busy ? '…' : 'Co udělá tvůj tvor?')}
      </div>
    </div>
  );
}
