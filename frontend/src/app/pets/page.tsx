'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PetCard } from '@/components/pet/PetCard';
import { errorMessage, gameApi, type Pet } from '@/lib/api';

export default function PetsPage() {
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    gameApi.myPets().then(setPets).catch((e) => { setPets([]); setError(errorMessage(e)); });
  }, []);

  const save = async (id: number) => {
    try {
      const p = await gameApi.renamePet(id, name);
      setPets((ps) => ps!.map((x) => (x.id === id ? p : x)));
      setEditing(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold">Moji PETi</h1>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      {pets?.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">Každé razítko ti dá PETa. <Link href="/map" className="text-primary underline">Vyraz na mapu</Link>.</p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {pets?.map((p) => (
          <PetCard key={p.id} pet={p}>
            <div className="mt-2 flex items-center justify-between text-xs">
              <Link href={`/place/${p.place.id}`} className="text-primary underline">{p.place.name}</Link>
              {editing === p.id ? (
                <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); save(p.id); }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Nové jméno"
                    className="w-28 rounded border border-input bg-background px-2 py-1" autoFocus />
                  <button className="rounded bg-primary px-2 py-1 text-primary-foreground">Uložit</button>
                </form>
              ) : (
                <button className="underline" onClick={() => { setEditing(p.id); setName(p.name); }}>Přejmenovat</button>
              )}
            </div>
          </PetCard>
        ))}
      </div>
    </AppShell>
  );
}
