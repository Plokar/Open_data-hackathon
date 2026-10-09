# ZÁPAD GO

**Pokémon GO pro Karlovarský kraj nad otevřenými daty kraje.** Choď po kraji, u hradu, rozhledny, pramene, muzea nebo místního výrobce *Dobroty Karlovarského kraje* vyfoť místo. Server ověří polohu, dostaneš razítko do Pasu a z místa se ti narodí **PET**. Ten pak bojuje v reálném čase s PETy ostatních hráčů.

Hackathon otevřených dat Karlovarského kraje 2026 (KIC KK + ZČU), Cheb.

- Aplikace: `https://www.<doména>` *(doplnit)*
- API a dokumentace: `https://api.<doména>/api/docs/` *(doplnit)*
- Specifikace: [PROJECT_SPEC.md](PROJECT_SPEC.md) · Práce v týmu a stav: [TEAM_AGENTS.md](TEAM_AGENTS.md)

## Data

617 míst z 20 vrstev portálu [DATA ZÁPAD](https://www.datazapad.cz) (hrady, zámky, rozhledny, prameny, UNESCO, muzea, přírodní pozoruhodnosti, koupací místa, technické památky, Dobroty kraje, infocentra) a 1 840 autobusových zastávek pro „nejbližší zastávku“ u každého místa. Licence CC0. Mapa © OpenStreetMap.

Import: `python manage.py import_places`. Výsledek je commitnutý jako fixture `backend/apps/places/fixtures/places.json`, takže aplikace běží i bez portálu.

## Lokální spuštění (bez Dockeru)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
export DJANGO_SETTINGS_MODULE=config.settings_local     # SQLite, bez Redis, DEMO_MODE=True
python manage.py migrate && python manage.py loaddata places badges
DEMO_PASSWORD=demo-heslo python manage.py seed_demo     # staff účty demo1 / demo2
python manage.py runserver 8000
pytest                                                  # testy

cd ../frontend && npm install && npm run dev            # http://localhost:3000
```
S Dockerem: `make up` (nebo `./dev.ps1 up`).

Kamera a GPS v telefonu vyžadují HTTPS. Testuj na nasazené verzi nebo přes tunel (`npx localtunnel --port 3000`).

## Nasazení

**Backend na VPS** (Docker + Traefik + Let's Encrypt):
1. DNS: `api.<doména>` (a případně `www.<doména>`) → IP VPS.
2. `git clone … /opt/zapadgo && cd /opt/zapadgo`
3. `cp .env.prod.example .env` a vyplnit všechna `CHANGE-ME` (hlavně `DOMAIN`, `AUTH_COOKIE_DOMAIN=.<doména>`, hesla). V `traefik/traefik.yml` nastavit e-mail pro Let's Encrypt.
4. `make prod-up`, pak `make prod-demo` (demo účty).
5. Ověření: `https://api.<doména>/api/health/` vrací `healthy`.
6. Zálohy: `crontab -e` → `15 3 * * * cd /opt/zapadgo && ./scripts/backup.sh >> backups/backup.log 2>&1` (obnova je popsaná v `scripts/backup.sh`).

**Frontend na Vercelu:** root `frontend/`, env `NEXT_PUBLIC_API_URL=https://api.<doména>`, `NEXT_PUBLIC_WS_URL=wss://api.<doména>`, vlastní doména `www.<doména>`.
Bez Vercelu: `docker compose --profile selfhost up -d --build`.

**Demo na pódiu:** `DEMO_MODE=True` povolí staff účtům „Demo razítko“ bez kontroly vzdálenosti. Takový PET je označený „demo“, nesmí do hodnocených soubojů a nepočítá se do žebříčků. V ostrém provozu `DEMO_MODE=False`.

## Demo účty

| Účet | Heslo | Poznámka |
|---|---|---|
| `demo1`, `demo2` | z `DEMO_PASSWORD` na serveru | staff, demo razítko |

## Jak to funguje

- **Razítko:** server ověří vzdálenost (≤ 300 m), přesnost GPS, rychlost přesunu, čas zařízení, cooldown, duplicitní fotku (SHA-256 a dHash) a EXIF. Z toho spočítá *trust*. Neověřené razítko se uloží, ale PET nesmí do hodnocených soubojů.
- **PET:** deterministický ze `sha256(místo + fotka + hráč)`. Typ podle kategorie místa, rarita podle místa (UNESCO = legendární).
- **Souboje:** tahy počítá server (`apps/battles/engine.py`), přenos přes WebSocket, 15 s na tah. Boj jde z logu přesně přehrát.
- **Pro kraj:** `/insights` ukazuje anonymní souhrn návštěvnosti a neobjevená místa.

## Použití AI

Viz [PROJECT_SPEC.md, sekce 11](PROJECT_SPEC.md). Ve výchozím stavu je AI vypnutá (`AI_VISION_VERIFY`, `AI_LORE`) a hra funguje celá bez ní. Při vývoji tým používal AI asistenty a každou část kódu umí vysvětlit.

## Stack

Django 4.2 + DRF + Channels (Daphne), PostgreSQL 16, Redis 7, Traefik · Next.js 16 (App Router), Tailwind v4, Leaflet.
