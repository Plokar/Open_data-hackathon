'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { gameApi, type LeaderRow } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Stamp, Trophy } from 'lucide-react';

type Scope = 'global' | 'school' | 'team';
type Metric = 'stamps' | 'wins';
const SCOPES: [Scope, string][] = [['global', 'Hráči'], ['school', 'Školy'], ['team', 'Týmy']];
const METRICS: [Metric, string][] = [['stamps', 'Razítka'], ['wins', 'Výhry']];

function Tabs<T extends string>({ items, value, onChange, label }: { items: [T, string][]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex rounded-xl bg-muted p-1" role="tablist" aria-label={label}>
      {items.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={cn('h-10 flex-1 cursor-pointer rounded-lg text-sm font-semibold', value === k ? 'bg-card shadow-[0_1px_3px_rgb(28_43_34/0.2)]' : 'text-muted-foreground')}>
          {l}
        </button>
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>('global');
  const [metric, setMetric] = useState<Metric>('stamps');
  const [rows, setRows] = useState<LeaderRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    gameApi.leaderboard(scope, metric).then((r) => alive && setRows(r)).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [scope, metric]);

  const mine = scope === 'global' ? user?.profile.nickname : scope === 'school' ? user?.profile.school : undefined;

  return (
    <AppShell>
      <h1 className="text-3xl font-extrabold">Žebříček</h1>
      <div className="mt-3 space-y-2">
        <Tabs items={SCOPES} value={scope} onChange={(v) => { setRows(null); setScope(v); }} label="Rozsah" />
        <Tabs items={METRICS} value={metric} onChange={(v) => { setRows(null); setMetric(v); }} label="Metrika" />
      </div>
      {scope === 'team' && <p className="mt-2 text-xs text-muted-foreground"><Link href="/team" className="text-primary underline">Založ nebo se přidej do týmu</Link></p>}

      {!rows ? <p className="mt-4 text-sm text-muted-foreground">Načítám…</p> : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Zatím nikdo. Buď první!</p>
      ) : (
        <ol className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
          {rows.map((r, i) => (
            <li key={r.name} className={cn('flex min-h-14 items-center gap-3 px-3 py-2', r.name === mine && 'bg-primary/10')}>
              <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black tabular-nums', i === 0 ? 'bg-trail-yellow text-[#1c2b22]' : i === 1 ? 'bg-input' : i === 2 ? 'bg-[#c9946a] text-[#1c2b22]' : 'text-muted-foreground')}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                {scope === 'global' ? <Link href={`/u/${encodeURIComponent(r.name)}`} className="font-semibold hover:underline">{r.name}</Link> : <b>{r.name}</b>}
                <span className="ml-2 text-xs text-muted-foreground">{scope === 'global' ? `lvl ${r.level}` : `${r.players} hráčů`}</span>
              </span>
              <span className="text-right text-sm font-bold tabular-nums"><span className="inline-flex items-center gap-1">{metric === 'stamps' ? r.stamps : r.wins}{metric === 'stamps' ? <Stamp className="h-4 w-4 text-trail-red" aria-label="razítek" /> : <Trophy className="h-4 w-4 text-trail-yellow" aria-label="výher" />}</span></span>
            </li>
          ))}
        </ol>
      )}
    </AppShell>
  );
}
