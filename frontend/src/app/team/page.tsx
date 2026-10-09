'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage, teamApi, type Team } from '@/lib/api';

export default function TeamPage() {
  const [team, setTeam] = useState<Team | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    teamApi.mine().then((r) => setTeam(r.team)).catch((e) => setError(errorMessage(e)));
  }, []);

  const run = async (fn: () => Promise<{ team: Team | null }>) => {
    setError('');
    try {
      setTeam((await fn()).team);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold">Tým</h1>
      {team === undefined && !error && <p className="text-sm text-muted-foreground">Načítám…</p>}
      {team && (
        <div className="mt-3 rounded-2xl border border-border p-4">
          <div className="text-xl font-bold">{team.name}</div>
          <p className="mt-1 text-sm">Kód pro přidání: <b className="rounded bg-muted px-2 py-0.5 font-mono tracking-widest">{team.join_code}</b></p>
          <div className="mt-4 rounded-xl bg-muted p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">Týdenní výzva</span>
              <span className="text-sm tabular-nums">{team.challenge.progress}/{team.challenge.target}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-label="Týdenní výzva týmu"
              aria-valuenow={team.challenge.progress} aria-valuemin={0} aria-valuemax={team.challenge.target}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (100 * team.challenge.progress) / Math.max(1, team.challenge.target))}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {team.challenge.progress >= team.challenge.target
                ? 'Splněno, tým má tento týden hotovo.'
                : 'Každý člen přispěje třemi razítky od pondělí do neděle.'}
            </p>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {team.members.map((m) => (
              <li key={m.nickname} className="flex justify-between gap-2">
                <span>{m.nickname} <span className="text-muted-foreground">úroveň {m.level}</span></span>
                <span className="tabular-nums text-muted-foreground">tento týden {m.week}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-4 w-full" onClick={() => run(teamApi.leave)}>Opustit tým</Button>
        </div>
      )}
      {team === null && (
        <div className="mt-3 space-y-4">
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => teamApi.join(code)); }}>
            <label className="block text-sm font-semibold">Přidat se kódem
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="A1B2C3" maxLength={8} required />
            </label>
            <Button className="w-full">Přidat se</Button>
          </form>
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => teamApi.create(name)); }}>
            <label className="block text-sm font-semibold">Nebo založ nový tým
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chebští vlci" minLength={3} maxLength={60} required />
            </label>
            <Button variant="secondary" className="w-full">Založit tým</Button>
          </form>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </AppShell>
  );
}
