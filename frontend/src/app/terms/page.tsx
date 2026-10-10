import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = { title: 'Pravidla hry' };

export default function TermsPage() {
  return (
    <AppShell>
      <article className="space-y-4 text-sm leading-relaxed">
        <h1 className="text-2xl font-extrabold">Pravidla hry</h1>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Razítko získáš jen fyzicky u místa (do 300 m). Podvržení polohy nebo cizí fotky vede ke zneplatnění razítek a tvorů.</li>
          <li><b>Bezpečnost má přednost.</b> Nevstupuj do uzavřených prostor, štol, na zříceniny ani na soukromé pozemky. U nebezpečných míst platí razítko z veřejně přístupného bodu.</li>
          <li>Respektuj otevírací doby, místní pravidla a přírodu. Nefoť lidi.</li>
          <li>Přezdívka nesmí být urážlivá ani vydávat se za někoho jiného.</li>
          <li>Hra je hackathonový prototyp „tak jak je“; data se mohou smazat nebo změnit.</li>
          <li>Údaje o místech jsou z otevřených dat Karlovarského kraje a z Wikidat pro Plzeňský kraj (CC0) a nemusí být aktuální.</li>
        </ol>
      </article>
    </AppShell>
  );
}
