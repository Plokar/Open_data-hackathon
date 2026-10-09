'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Swords, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PetPicker, isInjured } from '@/components/battle/PetPicker';
import { Button } from '@/components/ui/button';
import { Guide } from '@/components/guide/Guide';
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
      const best = [...ps].sort((a, b) => Number(isInjured(a)) - Number(isInjured(b)) || Number(b.verified) - Number(a.verified) || b.level - a.level || b.atk - a.atk)[0];
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
      <h1 className="text-3xl font-extrabold">Souboj</h1>
      {pets?.length === 0 ? (
        <Guide who="vridla" className="mt-6"
          action={<Link href="/map" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Najít místo</Link>}>
          Do souboje potřebuješ tvora a toho ti vylíhnu z prvního razítka. Tak hurá ven.
        </Guide>
      ) : (
        <>
          <h2 className="mt-5 font-semibold">Koho pošleš?</h2>
          {pets && <PetPicker pets={pets} value={petId} onChange={setPetId} />}

          <div className="mt-5 grid gap-2">
            <Button size="lg" onClick={() => start('ranked')} isLoading={busy === 'ranked'} disabled={!!busy || !pet?.verified || isInjured(pet)}>
              <Swords className="h-5 w-5" /> Hodnocený souboj
            </Button>
            {pet && !pet.verified && <p className="text-center text-xs text-muted-foreground">Ukázkoví a neověření tvorové můžou jen do tréninku a přátelského souboje.</p>}
            <Button size="lg" variant="outline" onClick={() => start('friendly')} isLoading={busy === 'friendly'} disabled={!!busy || !pet || isInjured(pet)}>
              <Users className="h-5 w-5" /> Vyzvat kamaráda (odkaz)
            </Button>
            <Button size="lg" variant="secondary" onClick={() => start('practice')} isLoading={busy === 'practice'} disabled={!!busy || !pet || isInjured(pet)}>
              <Bot className="h-5 w-5" /> Trénink proti strážci místa
            </Button>
          </div>
          {error && <p role="alert" className="mt-3 text-center text-sm text-destructive">{error}</p>}

          <details className="mt-8 rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed">
            <summary className="cursor-pointer font-semibold">Pravidla souboje</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Každý tah stojí <b className="text-foreground">výdrž</b>, po tahu se kousek obnoví. <b className="text-foreground">Útok</b> je zdarma a vždy zasáhne, <b className="text-foreground">Silný úder</b> je silnější, ale netrefí se vždy.</li>
              <li><b className="text-foreground">Obrana</b> sníží další zásah na polovinu a obnoví víc výdrže. Tvor typu Chuť se navíc vyléčí o 10 %.</li>
              <li><b className="text-foreground">Kouzla</b> jsou podle typu tvora a berou sílu z Magie. Každá evoluce odemkne silnější kouzlo.</li>
              <li>Výhry i prohry dávají tvorovi XP. Kdo prohraje, je <b className="text-foreground">30 minut zraněný</b> a nemůže bojovat.</li>
              <li>Pevnost přebíjí Výhled, ten Přírodu, ta Pramen, ten Kulturu a Kultura zase Pevnost. Výhodný typ dává 1,5× větší zásah.</li>
              <li>Na tah máš 25 sekund, pak za tebe server zahraje Útok. Všechno počítá server.</li>
            </ul>
          </details>
        </>
      )}
    </AppShell>
  );
}
