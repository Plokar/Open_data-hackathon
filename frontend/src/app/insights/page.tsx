'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { statsApi, type PlaceFeature, type PlaceStatRow, type PlaceStats } from '@/lib/api';
import { CATEGORY } from '@/lib/game';

const PlacesMap = dynamic(() => import('@/components/map/PlacesMap'), { ssr: false });
const NONE = new Set<number>();

function Bars({ rows }: { rows: { label: string; stamps: number; places: number; color?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.stamps));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-sm">
          <span className="w-40 shrink-0 truncate">{r.label}</span>
          <div className="h-2.5 flex-1 rounded-full bg-muted">
            <div className="h-2.5 rounded-full" style={{ width: `${(100 * r.stamps) / max}%`, background: r.color ?? 'var(--primary)' }} />
          </div>
          <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">{r.stamps} razítek / {r.places} míst</span>
        </div>
      ))}
    </div>
  );
}

function PlaceList({ rows }: { rows: PlaceStatRow[] }) {
  return (
    <ol className="space-y-1 text-sm">
      {rows.map((p) => (
        <li key={p.id} className="flex justify-between gap-2">
          <Link href={`/place/${p.id}`} className="truncate underline-offset-2 hover:underline">{CATEGORY[p.category].icon} {p.name}</Link>
          <span className="shrink-0 text-xs text-muted-foreground">{p.okres} · {p.stamps}×</span>
        </li>
      ))}
    </ol>
  );
}

export default function InsightsPage() {
  const router = useRouter();
  const [s, setS] = useState<PlaceStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    statsApi.places().then(setS).catch(() => setError('Statistiky se nepodařilo načíst.'));
  }, []);

  // Navštívená místa na mapu, počet razítek je v tooltipu.
  const features = useMemo<PlaceFeature[]>(() => (s?.visited ?? []).map((v) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
    properties: { id: v.id, name: `${v.name} (${v.stamps}×)`, category: v.category, subtype: '', rarity: 'common', okres: '', is_hazardous: false },
  })), [s]);

  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold">Co hráči objevují</h1>
      <p className="text-sm text-muted-foreground">Anonymní souhrn razítek pro Karlovarský kraj. Bez identity hráčů a bez demo razítek, aktualizace každou minutu.</p>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {s && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-muted p-3 text-center"><div className="text-2xl font-black">{s.total_stamps}</div><div className="text-xs text-muted-foreground">razítek</div></div>
            <div className="rounded-xl bg-muted p-3 text-center"><div className="text-2xl font-black">{s.total_players}</div><div className="text-xs text-muted-foreground">hráčů s razítkem</div></div>
          </div>

          <h2 className="mt-5 font-bold">Mapa návštěvnosti</h2>
          <div className="mt-2 h-72 overflow-hidden rounded-xl border border-border">
            <PlacesMap features={features} stamped={NONE} onSelect={(f) => router.push(`/place/${f.properties.id}`)} />
          </div>

          <h2 className="mt-5 font-bold">Podle okresů</h2>
          <div className="mt-2"><Bars rows={s.by_okres.map((r) => ({ label: r.okres, stamps: r.stamps, places: r.places }))} /></div>

          <h2 className="mt-5 font-bold">Podle kategorií</h2>
          <div className="mt-2"><Bars rows={s.by_category.map((r) => ({ label: `${CATEGORY[r.category].icon} ${CATEGORY[r.category].label}`, stamps: r.stamps, places: r.places, color: CATEGORY[r.category].color }))} /></div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><h2 className="mb-2 font-bold">Nejnavštěvovanější</h2>{s.top.length ? <PlaceList rows={s.top} /> : <p className="text-sm text-muted-foreground">Zatím žádná razítka.</p>}</div>
            <div><h2 className="mb-2 font-bold">Neobjevená místa – tip na výlet</h2><PlaceList rows={s.least} /></div>
          </div>
        </>
      )}
    </AppShell>
  );
}
