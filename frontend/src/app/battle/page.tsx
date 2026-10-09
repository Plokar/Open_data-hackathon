'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Swords, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PetPicker } from '@/components/battle/PetPicker';
import { Button } from '@/components/ui/button';
import { battleApi, errorMessage, gameApi, type Pet } from '@/lib/api';

export default function BattleLobby() {
  const router = useRouter();
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [petId, setPetId] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    gameApi.myPets().then((ps) => {
      setPets(ps);
      const best = [...ps].sort((a, b) => Number(b.verified) - Number(a.verified) || b.level - a.level || b.atk - a.atk)[0];
      setPetId(best?.id ?? null);
    }).catch((e) => { setPets([]); setError(errorMessage(e)); });
  }, []);

  const pet = pets?.find((p) => p.id === petId);

  const start = async (mode: 'practice' | 'friendly' | 'ranked') => {
    if (!petId) return;
    setBusy(mode);
    setError('');
    try {
      const b = await battleApi.create(mode, petId);
      router.push(`/battle/${b.battle_id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy('');
    }
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold">Souboj</h1>
      {pets?.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nejdřív potřebuješ PETa – získáš ho razítkem. <Link href="/map" className="text-primary underline">Na mapu</Link>.</p>
      ) : (
        <>
          <h2 className="mt-4 text-sm font-semibold text-muted-foreground">Vyber PETa</h2>
          {pets && <PetPicker pets={pets} value={petId} onChange={setPetId} />}

          <div className="mt-5 grid gap-2">
            <Button size="lg" onClick={() => start('ranked')} isLoading={busy === 'ranked'} disabled={!!busy || !pet?.verified}>
              <Swords className="h-5 w-5" /> Hodnocený souboj
            </Button>
            {pet && !pet.verified && <p className="text-center text-xs text-muted-foreground">Demo a neověření PETi můžou jen do tréninku a přátelského souboje.</p>}
            <Button size="lg" variant="outline" onClick={() => start('friendly')} isLoading={busy === 'friendly'} disabled={!!busy || !pet}>
              <Users className="h-5 w-5" /> Vyzvat kamaráda (odkaz)
            </Button>
            <Button size="lg" variant="secondary" onClick={() => start('practice')} isLoading={busy === 'practice'} disabled={!!busy || !pet}>
              <Bot className="h-5 w-5" /> Trénink proti strážci místa (bot)
            </Button>
          </div>
          {error && <p role="alert" className="mt-3 text-center text-sm text-destructive">{error}</p>}

          <div className="mt-6 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            <b className="text-foreground">Pravidla:</b> Útok (síla 40, vždy zasáhne) · Silný úder (síla 70, 70 % zásah) · Obrana (další zásah poloviční; Chuť navíc léčí 10 %).
            Typy: Pevnost › Výhled › Příroda › Pramen › Kultura › Pevnost (×1,5). Na tah máš 15 s, pak server zahraje Útok. Vše počítá server.
          </div>
        </>
      )}
    </AppShell>
  );
}
