# ZÁPAD GO – specifikace projektu (pracovní název)

> **Rozdělení práce, stav a zadání pro agenty: `TEAM_AGENTS.md`.**
>
> **Tento soubor je zdroj pravdy pro lidi i AI agenty.** Když se něco v kódu rozchází se specifikací, buď se opraví kód, nebo se (po domluvě) opraví tento soubor. Nahrazuje starý obsah `addition.md` (návrh s Firebase a Flutterem je **zrušen**).

Hackathon otevřených dat Karlovarského kraje 2026 (KIC KK + ZČU), Cheb. Start pátek 9. 10. 2026 16:00, prezentace sobota 10. 10. 17:00. Téma se vyhlašuje při zahájení – viz sekci 15 (riziko tématu).

---

## 0. Pravidla pro agenty (čti první)

1. **Neměň cizí soubory.** Každý workstream (sekce 14) vlastní své adresáře. Cokoli mimo ně řeš přes dohodnutý kontrakt (sekce 9 a 10), ne editací cizího kódu.
2. **Next.js je tu novější, než znáš.** Před psaním frontendu si přečti `frontend/AGENTS.md` a příslušné části v `frontend/node_modules/next/dist/docs/`. (V projektu je `src/proxy.ts`, ne `middleware.ts`.)
3. **Nejdřív nejmenší funkční řez.** Dodej P0 (sekce 15) end-to-end, až pak cokoli dalšího. Nic „do zásoby".
4. **Žádné falešné chování v produkci.** Herní logika (vzdálenost, rarity, staty, výsledek souboje) se počítá **na serveru**. Klient nikdy neposílá výsledek, jen vstup. Výjimka je explicitně označený `DEMO_MODE` (sekce 8.3).
5. **Odpovídej na kritéria poroty** (sekce 2). Když váháš mezi dvěma řešeními, vyber to, které lépe využije otevřená data nebo se líp ukáže v 5minutové demo.
6. **Čeština v UI i v textech** pro uživatele. Kód, názvy proměnných a komentáře k logice anglicky nebo česky konzistentně s okolním souborem.
7. **Každá netriviální logika má jeden spustitelný test** (anti-cheat pravidla, battle engine, badge pravidla, importér). Žádné rozsáhlé testovací sady.
8. **Tajemství nikdy v gitu.** Jen `.env.example`.
9. **AI se používá a musí jít obhájit.** Pravidla hackathonu: projekt nesmí být čistě generovaný AI a tým musí vysvětlit, jak AI použil. Každé použití AI v produktu se zapíše do sekce 11 (Použití AI) tohoto souboru.

---

## 1. Vize a pitch

**Pokémon GO pro Karlovarský kraj, postavené na otevřených datech kraje.**

Hráč chodí po kraji. Když je do 300 m od hradu, rozhledny, pramene, zámku, muzea nebo místního výrobce z programu *Dobrota Karlovarského kraje*, vyfotí místo. Server ověří polohu a fotku, hráč dostane **razítko do Pasu** a z místa mu vznikne **PET** (tvor odvozený od typu místa). PETi spolu bojují v reálném čase proti ostatním hráčům. Za série míst se sbírají **odznaky** (např. „všechny rozhledny", „celý okres Cheb").

**Proč to dává smysl pro kraj (kritérium 4):**
- lidi se hýbou po celém kraji, ne jen v Karlových Varech (odznaky podle okresů),
- quest „ochutnej Dobrotu" posílá lidi k místním malým výrobcům,
- ke každému místu je vidět nejbližší autobusová zastávka (cesta bez auta),
- školní a týmový žebříček zapojí studenty (kategorie hackathonu).

**Jedna věta pro porotu:** „Z 1 000+ bodů otevřených dat kraje jsme udělali hru, která vede lidi na místa, o kterých nevěděli, a k místním výrobcům."

---

## 2. Hodnoticí kritéria a jak na ně odpovídáme

| Kritérium poroty | Jak ho řešíme |
|---|---|
| Využití otevřených dat | Pipeline z DATA ZÁPAD API (sekce 5): ~25 vrstev míst + zastávky + Dobroty + koupací místa s kvalitou vody. Vždy se zobrazuje zdroj (datazapad.cz, CC0). |
| Nápad a originalita | Pas + PET + souboje v reálném čase nad daty kraje. |
| Kvalita implementace | Serverem ověřovaná hra (anti-cheat), deterministický battle engine s testy, WebSocket souboje, nasazení na VPS. |
| Přínos pro lidi / správu | Turismus mimo centra, podpora místních výrobců, dostupnost bez auta, data o návštěvnosti míst jako výstup pro kraj (anonymní agregace, sekce 6.4). |
| Prezentace | Živé demo na telefonu + souboj dvou zařízení na pódiu (sekce 15). |

Další pravidla z pořadatele: tým 2–6 lidí; výstup musí být veřejně dostupný (web + GitHub); u nezletilých souhlas zákonného zástupce (týká se i našich uživatelů, viz sekci 12).

---

## 3. Rozhodnutí o architektuře

| Rozhodnutí | Volba | Důvod |
|---|---|---|
| Backend | **Django 4.2 + DRF + Channels (stávající šablona)** na VPS pod subdoménou | Potřebujeme sdílený stav, souboje v reálném čase a ověřování na serveru. Šablona už má JWT, WebSockety, Postgres, Redis, Traefik. |
| Frontend | **Next.js 16 (App Router, TS, Tailwind v4)**, PWA | Geolokace a kamera fungují v prohlížeči, porota otevře odkaz bez instalace. |
| Hosting frontendu | **Vercel** (výchozí) | Rychlé nasazení. Viz otevřená otázka O1 (cookies a doména). |
| Databáze | **PostgreSQL 16**, Redis 7 | Už v šabloně. PostGIS ne (stačí haversine na ~1 000 bodech). |
| Mapa | **Leaflet + OpenStreetMap dlaždice** | Bez API klíče. Atribuce OSM povinná. |

---

## 4. Architektura a nasazení

```
 Telefon / prohlížeč (PWA)
   │  HTTPS + cookies (JWT httpOnly)           WSS
   ▼                                            │
 Next.js frontend (Vercel)  ───── REST ─────►  api.<doména>  (VPS, Traefik)
   www.<doména>                                  ├─ Django ASGI (Daphne): REST + WebSockets
                                                 ├─ PostgreSQL (data, hra)
                                                 ├─ Redis (channel layer, cache, žebříčky)
                                                 └─ media volume (fotky, privátní)
```

- **Subdoména API:** `api.<doména>` (Traefik už v `docker-compose.yml` routuje `/api`, `/admin`, `/ws` – přepsat `Host(...)` na skutečnou doménu). TLS přes Let's Encrypt (resolver `letsencrypt` je v Traefiku).
- **Produkční compose:** ponechat `traefik`, `db`, `redis`, `backend`. Servis `frontend` v compose nechat jako **volitelný fallback** (běží-li frontend na VPS místo Vercelu).
- **Zdravotní kontrola:** `/api/health/` už existuje.
- **Zálohy:** nightly `pg_dump` + záloha media volume (cron na VPS). Nutné před prezentací.

---

## 5. Datová pipeline (otevřená data kraje)

Portál DATA ZÁPAD je ArcGIS Hub s otevřeným API bez klíče:

- celý katalog (DCAT): `https://www.datazapad.cz/data.json`
- CSV vrstvy: `https://www.datazapad.cz/api/download/v1/items/<ITEM_ID>/csv?layers=<LAYER>` (ověřeno funkční)
- GeoJSON: stejný endpoint, `.../geojson?layers=<LAYER>` (ověřit)
- Data jsou ve WGS84, každý řádek nese kód a název obce, ORP a okresu podle ČSÚ (to je klíč pro odznaky podle okresů).
- Licence: CC0 (ověřeno u Dobrot, u ostatních vrstev ověřit při importu a uložit do `Place.license`).

### 5.1 Vrstvy použité jako „místa" (ID se rozlišila z katalogu; počty řádků u většiny **neověřeny**)

| Kategorie hry | Vrstva | ITEM_ID | LAYER |
|---|---|---|---|
| `castle` | Hrady a jejich zříceniny | `c3a42c283f0649248326a0bbd7dc5cc3` | 0 |
| `castle` | Zámky | `464108d64a93430083119bfb0845af3c` | 3 |
| `lookout` | Rozhledny | `2fe4d27ac10341f6bd2b4ea6380a2599` | 0 |
| `spring` | Přístupné prameny | `92327bf761e14d3c8cd169b7d65fa418` | 3 |
| `culture` | Památky UNESCO | `135900efd11e4df1865987b57428eb9f` | 3 |
| `culture` | Národní kulturní památky | `c0ae279455b34b5fb4a929ef98675a5b` | 3 |
| `culture` | Muzea a galerie | `5aa3b9fe8da6474786ff2b9c81b006cb` | 0 |
| `culture` | Muzea v přírodě a skanzeny | `6be3423787fd4c1fa19a70b025e2eb64` | 3 |
| `culture` | Divadla | `805a0267da9e45eea0c20a2e3123189f` | 3 |
| `culture` | Náboženské památky | `2c9bd5558c4a495c8424a84bc6b370e2` | 3 |
| `culture` | Vojenské a pietní památky | `142875a7b4ba49769393c8a3b80cca6d` | 3 |
| `nature` | Přírodní pozoruhodnosti | `037f7b55d2d34fa88fd63bf2d2903839` | 3 |
| `nature` | Botanické zahrady a arboreta | `8ae1f28fc17f4918a0dba74bb11797ff` | 0 |
| `nature` | Solné jeskyně | `197c67d6a8604a78a57335fcabe4b4d2` | 0 |
| `nature` | Koupací místa s kontrolou kvality vody 2026 (26 řádků, ověřeno) | `239805159c8649609d1bd40a30439623` | 0 |
| `nature` | Aquaparky, koupaliště a bazény | `98d26c1b1c8f4bd49850af82a19a7f58` | 0 |
| `heritage` | Hornické a technické památky (**nebezpečné, viz 12.5**) | `3727aefc159e47fd8cb9d70432ab7397` | 3 |
| `heritage` | Archeologické památky (**nebezpečné, viz 12.5**) | `5b6083d1a59d46c59d26717b31e991d1` | 0 |
| `heritage` | Jiné atraktivity | `1e64adf22f8448a693f638c9f1334dc9` | 3 |
| `food` | **Dobroty Karlovarského kraje** (produkty + provozovny se souřadnicemi) | `5767506f1df649098991f462da16d497` | 3 |
| `info` | Turistická informační centra (volitelně, rozumný „základní tábor") | `785fbd982147426ca275496791930eb8` | 0 |

**Pomocné (nejsou to místa ke sbírání):**
- Autobusové zastávky – `979283f4b7ec4b778b8eed7aab6917c3`, layer 0, **1 840 řádků, ověřeno**. Slouží k výpočtu `nearest_stop_name` a `nearest_stop_m` pro každé místo.
- Seznam obcí a ORP – z polí v CSV (kód obce ČSÚ je společný klíč).
- Nemocnice (`03dbe5719ab64960ae70ee90af4790c6`, 3) a lékařská pohotovost (`72aa9de6abc94f949f3959e70e0d241d`, 0): mimo MVP, nepřidávat do hry.

### 5.1b Plzeňský kraj

Krajský portál `opendata.plzensky-kraj.cz/pamatky` má 3 300 památek, ale **bez souřadnic** a bez společného ID s NPÚ, proto se nepoužívá. Místa se berou z **Wikidat** (CC0, SPARQL v `importer.WIKIDATA_QUERY`): hrady, zříceniny, zámky, tvrze, rozhledny, kláštery, muzea, synagogy, kostely, židovské hřbitovy, PR/PP, vodopády a hradiště (nebezpečná jako archeologie v 5.1). Bez článku na cs.wikipedii se berou jen rozhledny a vodopády. NKP → `epic`, fotka P18 jde do `extra.commons` a `fetch_place_photos` ji bere přednostně. Výsledek je zhruba 860 míst ve všech 7 okresech, `source_item = wikidata-plzensky-kraj`.

Zastávky Plzeňského kraje jsou z **OpenStreetMap** (Overpass, ODbL), protože DATA ZÁPAD má jen karlovarské. Když jeden zdroj zastávek selže, místa jeho kraje si nechají staré `nearest_stop_*`.

### 5.2 Importér (Workstream A)

- `python manage.py import_places` stáhne vrstvy z 5.1, normalizuje a uloží do DB (`update_or_create` podle `(source_item, source_layer, source_object_id)`).
- **Názvy sloupců se liší mezi vrstvami** (např. `Zeměpisná délka v souřadnicovém systému WGS84` vs. `x_zeměpisná_délka_v_souřadnicovém_systému_WGS84`). Importér je hledá regexem `zeměpisná.*délka` a `zeměpisná.*šířka` (case-insensitive) a pro název `^(název|nazev)`. Vrstva, ve které souřadnice nenajde, se **přeskočí s hlasitým varováním** (nepadá celý import) a vypíše se ve shrnutí.
- Řádky bez platných souřadnic nebo mimo bounding box kraje (lon 12.0–13.5, lat 49.9–50.5) se přeskočí a spočítají.
- Popis (HTML) se zbaví tagů. Zdrojová URL a licence se uloží.
- **Commitnout výsledek jako fixture** (`backend/apps/places/fixtures/places.json`), aby aplikace běžela i když je portál nedostupný. `python manage.py loaddata places` je výchozí cesta při seedování; `import_places` je pro aktualizaci.
- Po importu: pro každé místo dopočítat nejbližší zastávku (haversine, brute force, 1 000 × 1 840 je zanedbatelné).
- Ke každému místu přiřadit `rarity` (tabulka v 7.2) a `is_hazardous` (12.5).
- Jednoduchý test: import z uložené ukázky CSV vyprodukuje očekávaný počet míst a platné souřadnice.

---

## 6. Doménový model

Nové Django aplikace nahrazují `apps/items` a `apps/projects`. Stávající `apps/authentication` a `apps/ws` zůstávají.

### 6.1 `apps/places`
- **Place**: `id`, `source_item`, `source_layer`, `source_object_id`, `name`, `category` (castle/lookout/spring/culture/nature/heritage/food/info), `lat`, `lon`, `description`, `url`, `obec_kod`, `obec`, `okres`, `orp`, `rarity` (common/rare/epic/legendary), `is_hazardous` (bool), `nearest_stop_name`, `nearest_stop_m`, `license`, `source_url`. Index na `(lat, lon)` a `category`.
- **Producer** (rozšíření `Place` kategorie `food`): `producer_name`, `product_name`, `product_category`, `year` – jen pole navíc v `Place.extra` (JSON), žádná nová tabulka.

### 6.2 `apps/game`
- **Profile** (1:1 k `User`): `nickname` (unikátní, veřejné), `age_group` (`under18`/`adult`), `consent_confirmed` (bool), `school` (volitelné), `xp`, `level`, `photo_public` (default `false`).
- **CheckIn**: `user`, `place`, `lat`, `lon`, `accuracy_m`, `distance_m`, `created_at`, `photo` (soukromý soubor), `photo_sha256`, `photo_phash`, `exif_status` (`ok`/`missing`/`mismatch`), `trust` (0–100), `verified` (bool), `is_demo` (bool), `forgotten` (bool, místo bylo v době razítka málo navštěvované, viz 7.8). **Unikátní `(user, place)`** – jedno razítko na místo.
- **Pet**: `owner`, `place` (zdrojové místo), `checkin`, `species`, `type` (viz 7.2), `name`, `rarity`, staty `hp`, `atk`, `defense`, `spd`, `level`, `xp`, `seed` (int), `lore` (text, volitelně z AI), `verified` (bool z check-inu), `created_at`.
- **Badge** (katalog, seed data): `code`, `name`, `description`, `rule` (JSON, viz 7.4), `icon`.
- **UserBadge**: `user`, `badge`, `awarded_at`.
- **Team**: `name`, `join_code`, `owner`; členství = `Profile.team` (jeden tým na hráče, místo tabulky TeamMember).
- Questy (7.5) se počítají z dat bez tabulek (`apps/game/quests.py`).

### 6.3 `apps/battles`
- **Battle**: `id` (UUID), `player_a`, `player_b` (null = bot/strážce), `pet_a`, `pet_b`, `mode` (`ranked`/`friendly`/`practice`), `status` (`waiting`/`active`/`finished`/`abandoned`), `seed`, `winner`, `log` (JSON, seznam tahů a výsledků), `created_at`, `finished_at`.
- Stav boje se po **každém tahu persistuje** (restart procesu nesmí ztratit boj).

### 6.4 Agregace pro kraj (příspěvek ke kritériu 4)
Endpoint `/api/stats/places/` vrací anonymně: počet razítek na místo, nejnavštěvovanější a nejméně navštěvovaná místa, rozložení podle okresů. Bez identity uživatelů. V UI stránka „Co hráči objevují" a v prezentaci jedna slide s mapou návštěvnosti.

---

## 7. Herní mechaniky

### 7.1 Check-in (razítko)
Hráč na detailu místa stiskne „Razítkovat", telefon pošle polohu a fotku najednou. Pravidla ověření viz sekci 8. Po úspěchu: razítko do Pasu, **vznikne PET**, přičtou se XP a vyhodnotí se odznaky a questy. Odpověď vrací vše najednou, aby UI mohlo ukázat animaci „získal jsi…".

### 7.2 PET
PET je deterministický z dat místa a ověřené fotky:

- **Typ** podle kategorie místa: `castle` → **Pevnost**, `lookout` → **Výhled**, `nature` → **Příroda**, `spring` → **Pramen**, `culture`/`heritage` → **Kultura**, `food` → **Chuť**.
- **Druh a jméno:** tabulka druhů na typ (několik jmen v češtině) vybraná podle `seed`. Jméno může hráč změnit.
- **Rarita** místa: `legendary` = UNESCO; `epic` = národní kulturní památka, nejméně navštěvovaná místa (dynamicky, bonus); `rare` = hrady, zámky, rozhledny; `common` = vše ostatní. Násobič statů: 1.0 / 1.15 / 1.3 / 1.6.
- **Seed** = `sha256(place_id + photo_sha256 + user_id)` → stabilní číslo. Z něj se odvodí odchylka statů ±10 % a výběr druhu.
- **Staty:** základ `hp 100`, `atk 20`, `defense 12`, `spd 10`, násobeno raritou a odchylkou. Level a XP zvyšují staty (každý level +4 % ke všem).
- **Bonus za sbírku:** za každé 3 razítka stejné kategorie +2 % k statům PETů tohoto typu hráče (odměna za průzkum).
- **Karta PETa:** procedurální ilustrace (SVG podle typu a druhu, barvy ze seedu) v rámečku. Fotka hráče se na veřejné kartě **nezobrazuje**, dokud si to hráč nezapne (`photo_public`).
- **Volitelně (stretch G):** vision AI vygeneruje krátké „lore" a název a ověří, že fotka odpovídá kategorii. Obrázková stylizace jen pokud zbude čas.

**Type chart** (pětice v cyklu, násobič ×1,5 / ×0,75; `Chuť` je neutrální a léčí 10 % HP při použití `guard`):
Pevnost > Výhled > Příroda > Pramen > Kultura > Pevnost.

### 7.3 Souboje
Na serveru, tahové, současné rozhodování obou hráčů, výsledek počítá `engine.py` (čistý Python bez Django, plně testovatelný).

- Každý tah hráč vybere ze tří akcí: **Útok** (síla 40, vždy zasáhne), **Silný úder** (síla 70, 70 % šance zásahu), **Obrana** (na další zásah poloviční zranění).
- Zranění: `floor(power * atk / (defense_eff) * type_mult * rng(0.9, 1.1) * DAMAGE_SCALE)`, minimálně 1; `DAMAGE_SCALE = 0.25` (ladění délky boje). Pořadí řeší `spd` (vyšší jedná dřív).
- RNG je `random.Random(seed ^ turn)`, takže boj lze z logu **přesně přehrát** a zkontrolovat.
- Limit 30 tahů, potom vyhrává vyšší zbývající HP v procentech.
- Časový limit tahu 15 s; po vypršení server automaticky zvolí **Útok**.
- **Režimy:**
  - `ranked` – oba PETi musí být `verified`; vítěz dostane XP a body do žebříčku.
  - `friendly` – výzva kamaráda přes odkaz nebo kód, bez žebříčku.
  - `practice` – proti **botovi (strážce místa)** s popiskem „bot". Pro případ, že není online soupeř (a pro demo). Bot není maskovaný za hráče.
- **Matchmaking:** fronta podle levelu (±3) – zatím v DB (čekající `ranked` boje z poslední minuty), po 10 s čekání UI nabídne `practice`.

### 7.4 Odznaky
Pravidla jsou deklarativní JSON ve fixture, vyhodnocuje je `badges.py` po každém check-inu:

- `{"type": "count", "category": "castle", "n": 5}` → „Hradní pán"
- `{"type": "all_in_category", "category": "lookout"}` → „Rozhledník"
- `{"type": "all_in_category", "category": "spring", "okres": "Karlovy Vary"}` → „Pramenař"
- `{"type": "district_complete", "okres": "Cheb", "categories_min": 3}` → „Chebsko dobyto"
- `{"type": "count", "category": "food", "n": 3}` → „Dobrotník"
- `{"type": "no_car", "n": 5}` → „Bez auta" (razítko v místě, kde `nearest_stop_m` ≤ 300; podporuje cestování MHD, neověřujeme ale, jak tam hráč dojel)
- `{"type": "season", "months": [6,7,8], "category": "nature", "n": 3}` → „Letní otužilec"

Seznam odznaků se plní z fixture; každý nový odznak = jeden záznam, žádný nový kód.

### 7.5 Questy
- **Denní místo:** deterministicky z `date` + `seed` vybere jedno doporučené místo (bonus XP ×2).
- **Dobrotový quest:** „Navštiv producenta Dobroty" (kategorie `food`), odměna je exkluzivní PET a odznak.
- **Série:** „3 místa tento týden".

### 7.6 Žebříčky a týmy
- Globální (razítka, výhry), **školní** (součet přes `Profile.school`), **týmový** (join_code).
- Počítá se z DB s cache v Redis (TTL 60 s), žádné materializované pohledy.

### 7.7 Stretch hráčské mechaniky (až po P0–P2)
- Mlha války na mapě (odkryté okolí navštívených míst).
- Evoluce PETa při dosažení levelu.
- Výměna PETů mezi hráči.

---

### 7.8 Rozšíření: rozložení turismu, počasí, výpravy, Dobroty
Vše se počítá z existujících dat, kromě `CheckIn.forgotten` bez nových tabulek (`apps/game/quests.py`).

- **Zapomenutá místa:** místo s nejvýše 2 skutečnými razítky (bez demo, nikdy `is_hazardous`) dá ×1,5 XP; razítko si uloží `forgotten=True`. Odznak „Objevitel“ (3×). `/api/stats/places/` vrací `forgotten_stamps` jako měřítko rozložení turistů.
- **Místo dne podle počasí a polohy hráče:** poloha z prohlížeče (jen když ji hráč už povolil, zaokrouhlená na ~1 km), jinak poslední razítko, jinak střed obou krajů. Open-Meteo (bez klíče) dostane jen buňku ~25 km, předpověď se cachuje na den a buňku. Místo dne se vybírá z míst do ~30 km od hráče a pro hráče se na den připne (bonus u razítka sedí, i když hráč mezitím popojel). Déšť → muzea, solné jeskyně, divadla. Jasno → rozhledny. Při výpadku nebo `WEATHER_ENABLED=False` platí původní výběr podle data. Open-Meteo je externí zdroj dat, ne AI.
- **Výpravy bez auta:** 3–4 různé druhy míst do 500 m od jedné autobusové zastávky (bez `info` a nebezpečných). Dokončení dá odznaky „První výprava“ a „Cestovatel bez auta“ (3×) a tvora o stupeň vzácnějšího, než odpovídá místu.
- **Dobrotový pas:** 5 druhů oceněných Dobrot (z `Place.extra.products[].category`, „Cukrářské výrobky“ se slévají s pekařskými, „Ostatní“ se ignoruje). Odznaky „Gurmán“ (3 druhy), „Mistr chutí“ (5). Ověřuje se návštěva výrobce, ne nákup.
- **Koupací místa:** data kraje nenesou změřenou kvalitu vody, jen druh místa a vybavení (`extra.swim`). Kvalita je odkaz na web KHS. Sezónní odznak „Koupací sezóna“ (3 koupací místa v červnu–srpnu).
- **Týdenní výzva týmu:** cíl 3 razítka na člena od pondělí, počítá se z razítek členů (`challenge` v odpovědi `teams/`). Bez odměny, jen ukazatel.
- **Otevřená data zpět:** `GET /api/stats/places.csv` (CC0), razítka po místech, počty 1–4 se uvádějí jako `<5`. JSON `/api/stats/places/` vrací přesné počty (anonymní agregace).

## 8. Anti-cheat („co nejméně fakovat")

Cíl je minimální podvod při rozumné složitosti, **ne nemožnost podvodu**. V prezentaci to říkáme čestně: webová aplikace nezjistí podvržené GPS na rootnutém zařízení; snižujeme šanci a dopad.

### 8.1 Pravidla ověření check-inu (vše na serveru, v `apps/game/anticheat.py`)
1. **Vzdálenost:** haversine mezi pozicí klienta a `Place` ≤ `CHECKIN_RADIUS_M` (výchozí 300).
2. **Přesnost:** `accuracy_m` ≤ 100 (jinak `LOW_ACCURACY`, hráč má počkat na lepší fix).
3. **Rychlost:** od posledního check-inu tohoto uživatele musí stačit reálná rychlost (≤ 130 km/h vzdušnou čarou); jinak `TOO_FAST`.
4. **Čas klienta:** `client_ts` se liší od serverového času o ≤ 120 s.
5. **Duplicitní razítko:** unikátní `(user, place)`, jinak `ALREADY_STAMPED`.
6. **Cooldown:** max. 1 check-in za 60 s na uživatele.
7. **Fotka:** typ JPEG/PNG/WebP, ≤ 8 MB, ověřit dekódováním (Pillow), ne jen příponou. `sha256` unikátní napříč celou DB (`DUPLICATE_PHOTO`); perceptual hash (dHash přes Pillow, `anticheat._dhash`) – blízký duplikát fotky stejného místa od jiného uživatele odmítnout.
8. **EXIF:** pokud fotka nese GPS, musí být do 1 km od místa; pokud nese `DateTimeOriginal`, nesmí být starší než 15 minut. Chybějící EXIF je **povolen** (mobilní prohlížeče ho často mažou), jen sníží `trust`.
9. **Vision AI (volitelné, vypínatelné `AI_VISION_VERIFY`):** model posoudí, zda fotka odpovídá kategorii místa. Výsledek **jen upravuje `trust`**, nikdy sám neblokuje.
10. **Trust skóre:** složené z výše uvedených signálů. `trust < 50` → check-in se uloží, `verified = false`, PET nelze použít v `ranked`.

Chybové kódy vrací API jako `{"error_code": "TOO_FAR", "detail": "...", "distance_m": 612}`; UI z nich skládá srozumitelnou češtinu.

### 8.2 Souboje
Výsledek, náhoda i staty počítá výhradně server. Klient posílá jen volbu akce. Log boje se ukládá a lze ho přehrát.

### 8.3 `DEMO_MODE` (jediná výjimka, viz pokyn „minimum faku")
Pořadatelé budou v Chebu a hrad je kilometr daleko. Pro demo existuje proměnná `DEMO_MODE=true` (**v produkci vypnuto**), která:
- povolí tlačítko „Demo razítko" na dev účtech (`is_staff`), které obejde jen krok 1–2 (vzdálenost a přesnost),
- uloží `CheckIn.is_demo = true`, PET dostane `verified = false` a zobrazí se u něj štítek „demo",
- demo PETi jsou vyloučeni z `ranked` a z žebříčků.

Ukazujeme to čestně: „Pro dnešní demo máme režim, který přeskočí vzdálenost, v ostrém provozu vypnutý."

---

## 9. REST API (kontrakt)

Prefix `/api/`. JSON, cookies JWT jako ve stávající šabloně. Dokumentace vzniká automaticky v `/api/docs/` (drf-spectacular); **tato tabulka je zamýšlený tvar, kterým se oba týmy řídí**.

**Auth (stávající + úprava):** `POST auth/register/` (nově `nickname`, `age_group`, `consent_confirmed`), `POST auth/token/`, `POST auth/token/refresh/`, `POST auth/logout/`, `GET/PUT auth/me/` (`PUT {photo_public}` přepíná, zda fotky z razítek vidí ostatní hráči, výchozí ne).

| Metoda | Cesta | Popis |
|---|---|---|
| GET | `places/geojson/` | Všechna místa jako GeoJSON (s `ETag`, cacheable). Filtry: `category`, `okres`. |
| GET | `places/{id}/` | Detail místa včetně `nearest_stop_*` a mého stavu (razítko ano/ne). |
| POST | `checkins/` | `multipart`: `place`, `lat`, `lon`, `accuracy`, `client_ts`, `photo`. 201 → `{checkin, pet, new_badges[], xp_gain, level_up}`. 400/403 → `error_code`. |
| GET | `checkins/me/` | Moje razítka (Pas). |
| GET | `pets/me/` | Moji PETi. |
| GET/PATCH | `pets/{id}/` | Detail; PATCH jen `name`. |
| GET | `badges/` | Katalog + můj postup (`progress`, `target`, `awarded`). |
| GET | `quests/` | Aktivní questy (`daily`, `weekly3`, `dobrota`, `dobrota3`, `trail`). |
| GET | `trails/` | Výpravy bez auta s postupem hráče (7.8). |
| GET | `food-pass/` | Druhy Dobrot a které hráč ochutnal (7.8). |
| GET | `leaderboard/` | `?scope=global\|school\|team&metric=stamps\|wins`. |
| POST | `battles/` | `{mode, pet_id, opponent_nickname?}` → `{battle_id, status}`. `practice` startuje hned. |
| POST | `battles/queue/` | Zařadí do matchmakingu. |
| POST | `battles/{id}/join/` | Přijetí `friendly` výzvy (kód/odkaz). |
| GET | `battles/{id}/` | Stav a log (pro přehrání). |
| GET/POST | `teams/`, `teams/join/`, `teams/leave/` | Můj tým / založit `{name}` / přidat se `{join_code}` / odejít. |
| DELETE | `auth/me/` | Smazání účtu včetně fotek. |
| GET | `users/{nickname}/` | Veřejný profil (nick, level, odznaky, PETi bez fotek). |
| GET | `stats/places/` | Anonymní agregace pro kraj. |
| GET | `stats/places.csv` | Návštěvnost míst jako otevřená data (CC0), počty pod 5 skryty. |

Chyby: `{"error_code": "...", "detail": "..."}` (stávající exception handler `core.exceptions` rozšířit).

## 10. WebSocket protokol souboje

URL `wss://api.<doména>/ws/battle/<battle_id>/`, autentizace jako stávající `apps/ws/middleware.py` (cookie nebo `?token=`). Přidat `routing.py` záznam.

**Klient → server**
- `{"type":"move","turn":3,"move":"attack|heavy|guard"}`
- `{"type":"ready"}` (po připojení)

**Server → klient**
- `{"type":"state","turn":3,"you":{hp,max_hp,guard},"opp":{...},"deadline":"ISO8601"}`
- `{"type":"turn_result","turn":3,"events":[{"actor":"you","move":"heavy","hit":true,"damage":34,"effectiveness":1.5}, ...]}`
- `{"type":"battle_end","winner":"you|opp|draw","xp":42,"rating_delta":+12}`
- `{"type":"opponent_disconnected","grace_s":20}` / `{"type":"error","error_code":"..."}`

Pravidla: server je jediný zdroj stavu; připojení po odpojení vrátí aktuální `state`; odpojený hráč má 20 s, pak automatické tahy (Útok); duplicitní nebo opožděný `move` ignorovat.

---

## 11. Použití AI (musí jít obhájit)

Zapisovat sem každé použití AI v produktu (a stručně i při vývoji):

| Místo | Co AI dělá | Je povinné? | Fallback |
|---|---|---|---|
| `AI_VISION_VERIFY` | Gemini vision odpoví ANO/NE, zda fotka odpovídá kategorii místa → `trust` +10 / −30 (`apps/game/ai_hooks.py`). | Ne (výchozí vypnuto) | Vypnuto, bez klíče nebo při chybě → delta 0. |
| `AI_LORE` | 2 věty příběhu PETa přes `AI_PROVIDER`. | Ne (výchozí vypnuto) | Šablonový text (`pets.template_lore`). |
| (stretch) stylizace fotky | Obrázek tvora. | Ne – neimplementováno | Procedurální SVG (`PetArt`). |

Využít stávající `services/ai_service.py` (provider mock/Gemini/OpenAI/Ollama). Mock musí fungovat bez klíče, ať demo nepadá. Vývoj s AI asistenty: tým rozumí a umí obhájit každou část kódu.

---

## 12. Bezpečnost, soukromí, děti

1. **Věk a souhlas:** při registraci volba `under18/adult` + potvrzení souhlasu (zákonný zástupce u nezletilých, v souladu s pravidly hackathonu). Uložit jen `consent_confirmed`.
2. **Minimum osobních dat:** veřejný je jen `nickname`. Skutečné jméno se neukazuje.
3. **Fotky jsou soukromé** (servíruje je endpoint s kontrolou vlastníka, ne veřejné `/media/`). Veřejně se ukazuje jen ilustrace PETa. Hráč může opt-in zveřejnit.
4. **Fotky osob:** UI před focením upozorní „Nefoť lidi, foť místo". Možnost smazat fotku a účet.
5. **Nebezpečná místa:** `is_hazardous` (hornické a technické památky, archeologické lokality, zříceniny s varováním v popisu) – u nich se zobrazí varování „Nevstupuj do uzavřených prostor" a razítko platí z **veřejně přístupného bodu** (dosah 300 m, nikdy instrukce vstupu). Za nebezpečná místa nejsou odznaky typu „všechny".
6. **Rate limiting:** DRF throttling (už v šabloně) + přísnější pro `checkins/` a `auth/*`.
7. **Cookies/CORS/CSRF:** viz O1; v produkci `Secure`, `HttpOnly`.
8. **GDPR stránka** (`/privacy` už existuje): doplnit, co ukládáme (poloha při check-inu, fotka, nick) a jak smazat.
9. **Atribuce:** v patičce „Data: DATA ZÁPAD (Karlovarský kraj, CC0) · Mapa © OpenStreetMap".

---

## 13. Frontend (Next.js)

Zachovat z šablony: `components/ui/*`, `ThemeContext`, `AuthContext`, cookie banner, `DashboardLayout` (přejmenovat na `AppShell`), `manifest.ts`, `proxy.ts`. Smazat: stránky projects/tasks/realtime/storage/ai z `dashboard/` a odpovídající typy v `lib/api.ts`.

**Stránky (App Router):**

| Cesta | Obsah |
|---|---|
| `/` | Úvodní stránka (pitch, tlačítko „Začít hrát", pár čísel z dat kraje). |
| `/map` | Mapa míst (Leaflet), filtry kategorií, moje poloha, razítkovaná místa zvýrazněná. |
| `/place/[id]` | Detail, popis, nejbližší zastávka, tlačítko „Razítkovat" (kamera + GPS). |
| `/pass` | Pas: razítka podle kategorií a okresů, postup k odznakům. |
| `/pets` | Sbírka PETů, detail, přejmenování. |
| `/battle` | Lobby (matchmaking, výzva kamaráda, trénink) a `/battle/[id]` (živý souboj přes WS). |
| `/leaderboard` | Globální, školní, týmový. |
| `/u/[nickname]` | Veřejný profil. |
| `/insights` | Co hráči objevují (agregace pro kraj). |

**Povinné technické detaily:**
- Geolokace: `navigator.geolocation.getCurrentPosition` s `enableHighAccuracy: true`; posílat `accuracy`.
- Foto: `<input type="file" accept="image/*" capture="environment">`. Před nahráním zmenšit na max. 1600 px (canvas) kvůli rychlosti na mobilu.
- Geolokace a kamera vyžadují HTTPS → na telefonu testovat přes nasazenou verzi nebo tunel.
- PWA: `manifest.ts` doplnit ikony, `display: standalone`, jazyk `cs`. Offline režim není požadavek.
- `useWebSocket.ts` (existuje) rozšířit o reconnect s backoffem a obnovení `state`.
- Chybové kódy z API přeložit do srozumitelných hlášek.
- Přístupnost: kontrast, `aria` u tlačítek akcí, použitelné bez barev (rarity mají i text).

---

## 14. Workstreamy pro agenty

Každý workstream vlastní uvedené cesty. Pořadí a závislosti jsou důležité.

| ID | Název | Vlastní | Závisí na | Dodá |
|---|---|---|---|---|
| **A** | Data a místa | `backend/apps/places/**` | – | Modely `Place`, `import_places`, fixture, `geojson` endpoint, test importéru. |
| **B** | Herní jádro | `backend/apps/game/**` | A | `Profile`, `CheckIn`, `Pet`, anti-cheat, odznaky, questy, žebříčky, endpointy z 9, testy anti-cheatu a badge pravidel. |
| **C** | Souboje | `backend/apps/battles/**`, `backend/apps/ws/routing.py` (jen přidání řádku) | B (Pet) | `engine.py` + testy, matchmaking, WS consumer, bot. |
| **D** | Frontend základ | `frontend/src/app/{page,map,place,pass}/**`, `lib/api.ts`, `components/map/**` | kontrakt 9 | Auth, mapa, check-in flow, Pas. |
| **E** | Frontend hra | `frontend/src/app/{pets,battle,leaderboard,u,insights}/**`, `components/pet/**` | kontrakt 9, 10 | PET karty, souboje, žebříčky. |
| **F** | Infra a nasazení | `docker-compose*.yml`, `traefik/**`, `.env*.example`, `Makefile`, `backend/config/**`, `backend/Dockerfile*` | – | Produkční compose pro VPS, subdoména, TLS, CORS/cookies, zálohy, smazání nepoužitého (items, projects). |
| **G** | AI vrstva (stretch) | `backend/services/ai_service.py` (jen rozšíření), `backend/apps/game/ai_hooks.py` | B | Vision ověření, lore, fallbacky. |

**Pravidla koordinace:**
- Kontrakt (9, 10) mění jen ten, kdo ho implementuje, a hned aktualizuje tento soubor.
- Frontend před hotovým backendem pracuje proti OpenAPI (`/api/schema/`) nebo ručním mockům v `frontend/src/mocks/` (smazat před mergem do `main`).
- Migrace dělá vždy vlastník aplikace; **nikdy dvě agenty nemigrují stejnou app**.
- Smazání `apps/items` a `apps/projects` (včetně `seed_demo_data`) provádí **F** jako první commit; endpointy `/api/ai/*` (dnes v `projects/ai_views.py`) přesune F do `apps/game/ai_views.py` nebo je odstraní, pokud je nebudeme potřebovat, A–C pak přidávají nové aplikace; `config/urls.py` a `settings.INSTALLED_APPS` upravuje F (ostatní jen oznámí, co přidat).

---

## 15. Plán a priority

| Priorita | Obsah | Cíl hotovo |
|---|---|---|
| **P0** | A (místa v DB + GeoJSON), D (mapa + detail), B (check-in s ověřením vzdálenosti, PET vznikne), F (VPS běží, HTTPS, subdoména) | pátek večer / noc |
| **P1** | Souboje (C + E): `practice` proti botovi, pak `ranked`/`friendly` v reálném čase; odznaky; Pas | sobota ráno |
| **P2** | Žebříčky, týmy, školy; Dobroty questy; `/insights`; ověřování fotek (pHash, EXIF) | sobota dopoledne |
| **P3 (stretch)** | AI vision a lore; mlha války; evoluce PETa | jen pokud zbude čas |
| **Zmrazení** | Od soboty 13:00 žádné nové funkce – jen opravy, zálohy, nácvik prezentace | sobota 13:00 |

### Demo skript (5 minut)
1. Mapa kraje s místy a Dobrotami (příběh dat).
2. Živé razítko na telefonu (nebo `DEMO_MODE` s přiznáním) → vznikne PET.
3. **Souboj dvou telefonů na pódiu** (dva účty, ranked).
4. Pas s odznakem a `/insights` (přínos pro kraj).
5. Jedna slide o anti-cheatu, použití AI a licencích dat.

### Riziko tématu
Téma se vyhlašuje až při zahájení. Pokud je výrazně vázané (např. jen vzdělávání, jen veřejná správa), je potřeba hru v pitchi **přerámovat**, ne předělat (např. „vzdělávací Pas kraje pro školy", žebříček škol je už v návrhu). Rozhodnutí o případné změně nese vedoucí týmu.

---

## 16. Otevřené otázky (potřebují rozhodnutí týmu)

| ID | Otázka | Výchozí předpoklad |
|---|---|---|
| O1 | Kde poběží frontend a pod jakou doménou? Cookies s `SameSite=Lax` fungují jen pokud web a API sdílejí registrovatelnou doménu (např. `www.x.cz` a `api.x.cz`). Na `*.vercel.app` by bylo nutné `SameSite=None; Secure` a CORS s credentials. | Vlastní doména: `www.<doména>` (Vercel) + `api.<doména>` (VPS). |
| O2 | Jaká je doména a IP VPS? | Doplní tým. |
| O3 | Má cílit hra i na pěší trasy mezi místy (routing)? | Ne, stačí vzdušná čára + nejbližší zastávka. |
| O4 | Bude AI vision zapnutá v ostrém provozu (náklady, API klíč)? | Zapnout jen pokud je k dispozici klíč a zbyde čas; jinak mock. |
| O5 | Název produktu a logo.=  „ZÁPAD GO" 

---

## 17. Definition of Done

- [ ] `loaddata places` naplní DB; `/api/places/geojson/` vrací místa všech kategorií z 5.1.
- [ ] Registrace → přihlášení → razítko v dosahu vytvoří PET; mimo dosah vrací `TOO_FAR`.
- [ ] Testy projdou: importér, anti-cheat pravidla, battle engine (determinismus, ukončení, žádné záporné HP), badge pravidla.
- [ ] Souboj dvou prohlížečů v reálném čase funguje, odpojení a návrat obnoví stav.
- [ ] Produkce běží na `api.<doména>` přes HTTPS; `DEMO_MODE=false` ověřeno.
- [ ] Záloha DB je naplánovaná a obnova ověřená.
- [ ] `/privacy` popisuje poznané zpracování; atribuce dat a OSM je viditelná.
- [ ] README obsahuje spuštění, adresy a demo účty; sekce 11 (AI) je aktuální.
- [ ] Veřejný repozitář s tímto souborem a odkazem na nasazenou aplikaci (požadavek pořadatele).
