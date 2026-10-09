'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { PetCard } from '@/components/pet/PetCard';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, errorMessage, gameApi, type PublicProfile } from '@/lib/api';

export default function ProfilePage() {
  const { nickname } = useParams<{ nickname: string }>();
  const { user, logout } = useAuth();
  const [p, setP] = useState<PublicProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    gameApi.user(decodeURIComponent(nickname)).then(setP).catch(() => setError('Hráč nenalezen.'));
  }, [nickname]);

  if (!p) return <AppShell><p className="text-sm text-muted-foreground">{error || 'Načítám…'}</p></AppShell>;
  const isMe = user?.profile.nickname === p.nickname;

  const removeAccount = async () => {
    if (!window.confirm('Opravdu smazat účet, razítka, PETy a fotky? Nejde to vrátit.')) return;
    try {
      await authApi.deleteMe();
      window.location.href = '/';
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold">{p.nickname}</h1>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-sm text-muted-foreground">
        Level {p.level} · {p.xp} XP{p.school && ` · ${p.school}`}{p.team && ` · tým ${p.team}`}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[['Razítka', p.stamps], ['Výhry', p.wins], ['PETi', p.pets.length]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-muted p-3"><div className="text-xl font-black">{v}</div><div className="text-xs text-muted-foreground">{k}</div></div>
        ))}
      </div>

      <h2 className="mt-5 font-bold">Odznaky</h2>
      {p.badges.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {p.badges.map((b) => <span key={b.code} className="rounded-full bg-yellow-400/15 px-3 py-1 text-sm">{b.icon} {b.name}</span>)}
        </div>
      ) : <p className="mt-1 text-sm text-muted-foreground">Zatím žádné.</p>}

      <h2 className="mt-5 font-bold">PETi</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {p.pets.map((pet) => <PetCard key={pet.id} pet={pet} />)}
      </div>

      {isMe && (
        <div className="mt-6 space-y-2">
          <button onClick={logout} className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold">Odhlásit se</button>
          <button onClick={removeAccount} className="w-full rounded-xl py-2.5 text-sm font-semibold text-destructive">Smazat účet a všechna data</button>
        </div>
      )}
    </AppShell>
  );
}
