# ZÁPAD GO – práce v týmu a zadání pro AI agenty

> Čtou lidé i AI agenti. **Agent: přečti nejdřív `PROJECT_SPEC.md` (zdroj pravdy), pak tento soubor, pak jen svůj úkol v sekci 4.**
> Stav k pátku 9. 10. 2026 večer. Kdo dokončí úkol, upraví tabulku v sekci 1 ve svém PR.

---

## 1. Co už je hotové (na `main`)

| Oblast | Stav | Kde |
|---|---|---|
| A – místa | ✅ 617 míst z 20 vrstev DATA ZÁPAD + 1 840 zastávek, fixture, GeoJSON s ETag, detail, `/api/stats/places/` | `backend/apps/places/` |
| B – herní jádro | ✅ registrace (přezdívka, věk, souhlas), check-in s anti-cheatem, PET, XP, 10 odznaků, questy, týmy, žebříček global/škola/tým, veřejný profil, smazání účtu | `backend/apps/game/` |
| C – souboje | ✅ engine, REST, WebSocket, bot, timeout 15 s, Elo | `backend/apps/battles/` |
| D – frontend základ | ✅ `/`, `/map`, `/place/[id]`, `/pass` (+ questy), `/register`, `/privacy`, `/terms`, PWA ikony | `frontend/src/app/` |
| E – frontend hra | ✅ `/pets`, `/battle`, `/battle/[id]`, `/leaderboard`, `/u/[nickname]`, `/team`, `/insights` | `frontend/src/app/` |
| F – infra | 🟡 připraveno (compose s `DOMAIN`, prod settings, zálohy, `seed_demo`, README) – **chybí reálné nasazení na VPS + Vercel** | kořen repa |
| G – AI | ✅ volitelné, výchozí vypnuto (`AI_VISION_VERIFY`, `AI_LORE`) s fallbacky | `backend/apps/game/ai_hooks.py` |

Testy: `cd backend && pytest` → 16 testů (importér, statistiky, anti-cheat, PET, end-to-end razítko + smazání účtu, questy a týmy, AI fallbacky, battle engine, souboj přes WebSocket).

**Odchylky od specu (vědomé):** tým jako `Profile.team` (bez TeamMember), questy bez tabulek; poškození v souboji má navíc `DAMAGE_SCALE = 0.25` (jinak boj končí ve 2. tahu); perceptual hash je vlastní dHash v Pillow místo knihovny `imagehash` (bez numpy/scipy); matchmaking je fronta v DB místo Redis. Vrstva *Aquaparky* nemá WGS84 sloupce, importér ji přeskočí.

---

## 2. Spuštění

**Bez Dockeru (nejrychlejší, SQLite):**
```bash
cd backend
python -m venv .venv && .venv/Scripts/activate        # Linux/Mac: source .venv/bin/activate
pip install -r requirements-dev.txt
export DJANGO_SETTINGS_MODULE=config.settings_local   # PowerShell: $env:DJANGO_SETTINGS_MODULE="config.settings_local"
python manage.py migrate && python manage.py loaddata places badges
python manage.py createsuperuser                      # is_staff → tlačítko „Demo razítko“
python manage.py runserver 8000                       # REST i WebSockety (daphne je první v INSTALLED_APPS)
pytest

cd ../frontend && npm install && npm run dev          # http://localhost:3000, NEXT_PUBLIC_API_URL=http://localhost:8000
```
**S Dockerem:** `./dev.ps1 up` (nebo `make up`). Entrypoint sám migruje a nahraje fixture.

`config.settings_local` = SQLite + paměťová cache/channel layer + `DEMO_MODE=True`. Pro testy se používá automaticky (`pytest.ini`).

Na telefonu potřebuješ HTTPS (kamera + GPS): `npx localtunnel --port 3000` nebo nasazenou verzi.

---

## 3. Pravidla týmu (git a agenti)

1. **Každý úkol = vlastní branch z aktuálního `main`**: `feat/<úkol>`, `infra/<úkol>`, `fix/<co>`. Malé PR, merge co nejdřív (ideálně do 2 h). Před PR: `git fetch && git rebase origin/main`.
2. **Vlastnictví souborů** (PROJECT_SPEC 14) platí. Mimo svůj úkol needituj; potřebuješ-li změnu jinde, napiš to do PR popisu nebo do týmového chatu.
3. **Sdílené soubory, kde hrozí konflikt** – měň jen pár řádků, nic nepřeformátovávej: `backend/config/settings.py`, `backend/config/urls.py`, `frontend/src/lib/api.ts`, `frontend/src/lib/game.ts`, `frontend/src/components/layout/AppShell.tsx`. Nové typy/volání API přidávej **na konec** `api.ts`.
4. **Migrace dělá jen vlastník aplikace** a commituje je ve stejném PR. Dva lidi nikdy nemigrují stejnou app.
5. **Kontrakt API** (PROJECT_SPEC 9, 10) měníš jen když ho implementuješ, a ve stejném PR upravíš spec.
6. **Herní logika jen na serveru.** Klient posílá vstup, nikdy výsledek.
7. **UI česky**, mobil first (šířka 375 px), dolní navigace je z `AppShell`. Tailwind v4 + tokeny z `globals.css` (`bg-card`, `text-muted-foreground`, `bg-primary` …).
8. **Next.js 16**: přečti `frontend/AGENTS.md`. Dynamické parametry v klientských stránkách přes `useParams()`, Leaflet jen přes `dynamic(..., { ssr: false })`. Middleware je `src/proxy.ts`.
9. **Netriviální logika = jeden test** (`backend/apps/<app>/tests.py`). Před PR: `pytest` (backend) a `npx tsc --noEmit && npx next build` (frontend).
10. **Použití AI v produktu** zapiš do PROJECT_SPEC sekce 11.
11. **Zmrazení: sobota 13:00.** Potom jen opravy.

---

## 4. Zbývající úkoly (zadání pro agenta – zkopíruj celou kartu do promptu)

### Úkol A – `infra/deploy` (P0, bez toho není veřejná URL)
**Vlastníš:** `docker-compose*.yml`, `traefik/**`, `.env*.example`, `Makefile`, `scripts/**`, `README.md`.
Vše je připravené. Postup je v README → „Nasazení“. Potřebuješ doménu, VPS s Dockerem a Vercel účet.
**Hotovo když:** `https://api.<doména>/api/health/` je `healthy`, na telefonu přes `https://www.<doména>` jde registrace, razítko, souboj. Proběhla záloha (`make backup`) a zkušební obnova. V README jsou doplněné URL.
Pozor: `AUTH_COOKIE_DOMAIN=.<doména>` a `CORS_ALLOWED_ORIGINS=https://www.<doména>` jsou povinné. Na demo instanci `DEMO_MODE=True`, v ostrém provozu `False`.

### Úkol B – `qa/mobile` (P0, nikdo to zatím nezkoušel v prohlížeči!)
**Vlastníš:** jen opravy chyb, které najdeš (malé PR, ke každé chybě 1 commit).
Projdi na skutečném Androidu i iPhonu (HTTPS): registrace (nezletilý i dospělý) → mapa (poloha, filtry, bottom sheet) → detail → Razítkovat (kamera, GPS, chyba `TOO_FAR` česky) → animace PETa → Pas (questy, odznaky) → PETi (přejmenování) → souboj trénink → přátelský souboj na 2 telefonech přes odkaz → F5 uprostřed souboje → žebříček, tým, `/insights`, smazání účtu. Tmavý i světlý motiv, šířka 375 px.

### Úkol C – `docs/presentation` (P1)
5minutové demo podle PROJECT_SPEC 15: slidy (data → razítko → souboj dvou telefonů → Pas a `/insights` → anti-cheat, AI, licence). Screenshoty z nasazené verze. Nacvičit se stopkami, mít záložní video.

### Úkol D – `feat/polish` (P2–P3, jen pokud zbude čas, do soboty 13:00)
Vyber jedno, nedělej vše:
- přepínač `photo_public` v profilu (`PUT /api/auth/me/` ho zatím neukládá → backend `apps/authentication` + UI),
- onboarding (3 obrazovky na `/` pro nové hráče),
- evoluce PETa na levelu 5 (`apps/game/pets.py` + `PetArt`),
- mlha války na mapě (`components/map/PlacesMap.tsx`).

## 5. Kde co najdeš (rychlá mapa)

| Potřebuji… | Soubor |
|---|---|
| seznam vrstev dat, import | `backend/apps/places/importer.py`, `python manage.py import_places [--from-dir]` |
| pravidla razítka | `backend/apps/game/anticheat.py`, `CheckInView` v `backend/apps/game/views.py` |
| staty a druhy PETů | `backend/apps/game/pets.py` |
| odznaky | `backend/apps/game/fixtures/badges.json` + `badges.py` |
| souboje | `backend/apps/battles/{engine,service,consumers,views}.py` |
| API klient, typy, české chybové hlášky | `frontend/src/lib/api.ts` (`errorMessage`) |
| barvy/ikony kategorií, typů, rarit | `frontend/src/lib/game.ts` |
| layout, dolní navigace, atribuce | `frontend/src/components/layout/AppShell.tsx` |

## 6. Prompt pro start agenta (šablona)

```
Pracuješ na projektu ZÁPAD GO (hackathon). Přečti WEB_Template/PROJECT_SPEC.md a WEB_Template/TEAM_AGENTS.md.
Tvůj úkol je „Úkol N – <název>“ ze sekce 4 TEAM_AGENTS.md. Pracuj na branchi <branch> vytvořené z origin/main.
Edituj jen soubory, které úkol vlastní; sdílené soubory jen minimálně (sekce 3). Nejdřív nejmenší funkční řez.
Na konci spusť testy/build, aktualizuj tabulku v sekci 1 a napiš krátký popis PR.
```
