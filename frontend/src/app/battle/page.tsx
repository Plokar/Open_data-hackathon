'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Send, Swords, Users, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PetPicker, isInjured } from '@/components/battle/PetPicker';
import { Challenges } from '@/components/battle/Challenges';
import { Button } from '@/components/ui/button';
import { Guide } from '@/components/guide/Guide';
import { battleApi, errorMessage, gameApi, type Pet } from '@/lib/api';

export default function BattleLobby() {
  const router = useRouter();
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [petId, setPetId] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [invite, setInvite] = useState(''); // ?invite=přezdívka z profilu přítele

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- query až po hydrataci (bez Suspense kvůli useSearchParams)
    setInvite(new URLSearchParams(window.location.search).get('invite') ?? '');
  }, []);

  useEffect(() => {
    gameApi.myPets().then((ps) => {
      setPets(ps);
      const best = [...ps].sort((a, b) => Number(isInjured(a)) - Number(isInjured(b)) || Number(b.verified) - Number(a.verified) || b.level - a.level || b.atk - a.atk)[0];
      setPetId(best?.id ?? null);
    }).catch((e) => { setPets([]); setError(errorMessage(e)); });
  }, []);

  const pet = pets?.find((p) => p.id === petId);

  const start = async (mode: 'practice' | 'friendly' | 'ranked' | 'ffa' | 'team') => {
    if (!petId) return;
    setBusy(mode);
    setError('');
    try {
      const b = await battleApi.create(mode, petId, mode === 'friendly' && invite ? invite : undefined);
      router.push(`/battle/${b.battle_id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy('');
    }
  };

  return (
    <AppShell>
      <h1 className="text-3xl font-extrabold">{invite ? `Výzva pro ${invite}` : 'Souboj'}</h1>
      {!invite && <Challenges className="mt-4" />}
      {pets?.length === 0 ? (
        <Guide who="vridla" className="mt-6"
          action={<Link href="/map" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Najít místo</Link>}>
          Do souboje potřebuješ tvora a toho ti vylíhnu z prvního razítka. Tak hurá ven.
        </Guide>
      ) : (
        <>
          <h2 className="mt-5 font-semibold">Koho pošleš?</h2>
          {pets && <PetPicker pets={pets} value={petId} onChange={setPetId} />}

          {invite ? (
            <div className="mt-5 grid gap-2">
              <Button size="lg" onClick={() => start('friendly')} isLoading={busy === 'friendly'} disabled={!!busy || !pet || isInjured(pet)}>
                <Send className="h-5 w-5" /> Poslat výzvu hráči {invite}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Výzvu uvidí v Souboji. Když jste spolu, ukážeš mu i QR kód.</p>
              <Link href="/battle" className="text-center text-sm font-semibold text-primary underline">Jiný souboj</Link>
            </div>
          ) : (
          <div className="mt-5 grid gap-2">
            <Button size="lg" onClick={() => start('ranked')} isLoading={busy === 'ranked'} disabled={!!busy || !pet?.verified || isInjured(pet)}>
              <Swords className="h-5 w-5" /> Hodnocený souboj
            </Button>
            {pet && !pet.verified && <p className="text-center text-xs text-muted-foreground">Ukázkoví a neověření tvorové můžou jen do tréninku a přátelského souboje.</p>}
            <Button size="lg" variant="outline" onClick={() => start('friendly')} isLoading={busy === 'friendly'} disabled={!!busy || !pet || isInjured(pet)}>
              <Users className="h-5 w-5" /> Vyzvat kamaráda (odkaz a QR)
            </Button>
            <Button size="lg" variant="secondary" onClick={() => start('practice')} isLoading={busy === 'practice'} disabled={!!busy || !pet || isInjured(pet)}>
              <Bot className="h-5 w-5" /> Trénink proti strážci místa
            </Button>
            <h2 className="mt-4 font-semibold">Skupinový souboj</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" variant="outline" className="h-auto flex-col gap-0.5 py-3" onClick={() => start('ffa')} isLoading={busy === 'ffa'} disabled={!!busy || !pet || isInjured(pet)}>
                <span className="flex items-center gap-1.5"><UsersRound className="h-5 w-5" /> Všichni proti všem</span>
                <span className="text-xs font-normal text-muted-foreground">3 hráči, vyhrává jeden</span>
              </Button>
              <Button size="lg" variant="outline" className="h-auto flex-col gap-0.5 py-3" onClick={() => start('team')} isLoading={busy === 'team'} disabled={!!busy || !pet || isInjured(pet)}>
                <span className="flex items-center gap-1.5"><Users className="h-5 w-5" /> 2 na 2</span>
                <span className="text-xs font-normal text-muted-foreground">dva týmy, vyhrává tým</span>
              </Button>
            </div>
          </div>
          )}
          {error && <p role="alert" className="mt-3 text-center text-sm text-destructive">{error}</p>}

          <details className="mt-8 rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed">
            <summary className="cursor-pointer font-semibold">Pravidla souboje</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Každý tah stojí <b className="text-foreground">výdrž</b>, po tahu se kousek obnoví. <b className="text-foreground">Útok</b> je zdarma a vždy zasáhne, <b className="text-foreground">Silný úder</b> je silnější, ale netrefí se vždy.</li>
              <li><b className="text-foreground">Obrana</b> sníží další zásah na polovinu a obnoví víc výdrže. Tvor typu Chuť se navíc vyléčí o 10 %.</li>
              <li><b className="text-foreground">Kouzla</b> jsou podle typu tvora a berou sílu z Magie. Každá evoluce odemkne silnější kouzlo.</li>
              <li>Výhry i prohry dávají XP tvorovi i tobě. Kdo prohraje nebo padne, je <b className="text-foreground">30 minut zraněný</b> a nemůže bojovat.</li>
              <li>Pevnost přebíjí Výhled, ten Přírodu, ta Pramen, ten Kulturu a Kultura zase Pevnost. Výhodný typ dává 1,5× větší zásah.</li>
              <li>Ve skupinovém souboji si u útoku vybereš, na koho míříš. Padlý tvor už nebojuje, ve 2v2 za něj pokračuje parťák.</li>
              <li>Bosové se objevují na mapě, každý týden jinde. Vyzvat je můžeš jen na místě (do 300 m), sám se sestavou až 3 tvorů (padlého nahradí další), nebo až se dvěma kamarády, a s každým jednou za týden. Za výhru je legendární tvor, XP si sestava rozdělí podle zranění.</li>
              <li>Na tah máš 25 sekund, pak za tebe server zahraje Útok. Všechno počítá server.</li>
            </ul>
          </details>
        </>
      )}
    </AppShell>
  );
}
