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
          <ul className="mt-3 space-y-1 text-sm">
            {team.members.map((m) => <li key={m.nickname}>{m.nickname} <span className="text-muted-foreground">· lvl {m.level}</span></li>)}
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
