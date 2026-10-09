'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Guide } from '@/components/guide/Guide';
import { PetCard } from '@/components/pet/PetCard';
import { Evolution } from '@/components/pet/Evolution';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage, gameApi, type Pet } from '@/lib/api';

export default function PetsPage() {
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [evo, setEvo] = useState<{ pet: Pet; evolved: Pet | null; error: string } | null>(null);

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

  const evolve = (pet: Pet) => {
    setEvo({ pet, evolved: null, error: '' });
    gameApi.evolvePet(pet.id)
      .then((p) => { setEvo((e) => e && { ...e, evolved: p }); setPets((ps) => ps!.map((x) => (x.id === p.id ? p : x))); })
      .catch((e) => setEvo((x) => x && { ...x, error: errorMessage(e) }));
  };

  return (
    <AppShell>
      {evo && <Evolution {...evo} onClose={() => setEvo(null)} />}
      <h1 className="text-3xl font-extrabold">Tvorové</h1>
      {pets && pets.length > 0 && <p className="mt-1 text-muted-foreground">{pets.length} {pets.length === 1 ? 'tvor' : pets.length < 5 ? 'tvorové' : 'tvorů'} z tvých razítek</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      {pets?.length === 0 && (
        <Guide who="vridla" className="mt-6"
          action={<Link href="/map" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Najít místo</Link>}>
          Zatím tu nikdo nebydlí. Každé razítko mi dá vejce a z něj ti vylíhnu tvora podle místa, kde jsi byl.
        </Guide>
      )}
      <div className="mt-5 space-y-4">
        {pets?.map((p) => (
          <PetCard key={p.id} pet={p} onEvolve={() => evolve(p)}>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
              {editing === p.id ? (
                <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); save(p.id); }}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Nové jméno" className="h-11" autoFocus />
                  <Button type="submit">Uložit</Button>
                </form>
              ) : (
                <>
                  <Link href={`/place/${p.place.id}`} className="min-w-0 truncate text-primary underline">{p.place.name}</Link>
                  <button className="h-11 shrink-0 cursor-pointer rounded-lg px-3 font-semibold hover:bg-accent" onClick={() => { setEditing(p.id); setName(p.name); }}>Přejmenovat</button>
                </>
              )}
            </div>
          </PetCard>
        ))}
      </div>
    </AppShell>
  );
}
