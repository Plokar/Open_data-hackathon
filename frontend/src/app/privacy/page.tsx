import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = { title: 'Ochrana soukromí' };

const ROWS: [string, string, string][] = [
  ['Přezdívka', 'veřejná – zobrazí se v žebříčku a profilu', 'do smazání účtu'],
  ['E-mail a heslo (hash)', 'přihlášení, obnova hesla; nikde se nezobrazuje', 'do smazání účtu'],
  ['Věková skupina a potvrzení souhlasu', 'u nezletilých dokládá souhlas zákonného zástupce', 'do smazání účtu'],
  ['Škola, tým (nepovinné)', 'školní a týmový žebříček', 'do smazání účtu'],
  ['Poloha při razítku (souřadnice, přesnost GPS, čas)', 'ověření, že jsi u místa (do 300 m); poloha se jinak nesleduje', 'do smazání účtu'],
  ['Fotka místa', 'ověření razítka (otisk proti kopírování, EXIF). Fotka je soukromá, vidíš ji jen ty', 'do smazání účtu'],
  ['Souboje a statistiky hry', 'průběh soubojů, XP, odznaky', 'do smazání účtu'],
];

export default function PrivacyPage() {
  return (
    <AppShell>
      <article className="space-y-4 text-sm leading-relaxed">
        <h1 className="text-2xl font-extrabold">Ochrana soukromí</h1>
        <p>
          ZÁPAD GO je hackathonový projekt (Hackathon otevřených dat Karlovarského kraje 2026). Sbíráme jen to, co hra nutně potřebuje.
          Ostatní hráči o tobě vidí jen <b>přezdívku</b>, level, odznaky a ilustrace PETů – nikdy jméno, e-mail, polohu ani fotky.
        </p>

        <h2 className="text-lg font-bold">Co ukládáme a proč</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-border"><th className="py-2 pr-2">Údaj</th><th className="pr-2">Účel</th><th>Doba</th></tr></thead>
            <tbody>
              {ROWS.map(([a, b, c]) => (
                <tr key={a} className="border-b border-border align-top"><td className="py-2 pr-2 font-semibold">{a}</td><td className="pr-2">{b}</td><td>{c}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-lg font-bold">Poloha a kamera</h2>
        <p>Prohlížeč se zeptá na polohu a fotoaparát. Polohu odešleme na server <b>jen ve chvíli, kdy stiskneš „Razítkovat“</b>. Na mapě se tvá poloha zobrazuje jen u tebe v zařízení. Fotka se před odesláním zmenší.</p>
        <p><b>Nefoť lidi, foť místo.</b> Fotky nejsou veřejné, veřejně se ukazuje jen kreslená ilustrace PETa.</p>

        <h2 className="text-lg font-bold">Děti a mladiství</h2>
        <p>Při registraci volíš věkovou skupinu. Hráči mladší 18 let potvrzují souhlas zákonného zástupce. Ukládáme jen informaci, že souhlas byl potvrzen.</p>

        <h2 className="text-lg font-bold">Cookies</h2>
        <p>Používáme jen nezbytné cookies pro přihlášení (JWT, httpOnly) a uložení motivu. Žádná analytika ani reklama.</p>

        <h2 className="text-lg font-bold">Pro kraj: jen anonymní souhrny</h2>
        <p>Stránka „Co hráči objevují“ ukazuje počty razítek na místech, v okresech a kategoriích. Neobsahuje nikoho identitu.</p>

        <h2 className="text-lg font-bold">Smazání účtu</h2>
        <p>Na svém profilu (klikni na přezdívku vpravo nahoře) najdeš „Smazat účet“. Smažeme účet, razítka, PETy, souboje i všechny fotky. Nejde to vrátit.</p>

        <h2 className="text-lg font-bold">Zdroje dat</h2>
        <p>Místa pochází z portálu <a className="text-primary underline" href="https://www.datazapad.cz" target="_blank" rel="noreferrer">DATA ZÁPAD</a> (Karlovarský kraj, licence CC0). Mapové podklady © přispěvatelé OpenStreetMap.</p>

        <h2 className="text-lg font-bold">Kontakt</h2>
        <p>Správce: tým ZÁPAD GO. Kontakt najdeš v README veřejného repozitáře projektu.</p>
      </article>
    </AppShell>
  );
}
