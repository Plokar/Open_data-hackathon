# Django + Next.js (React) + Tailwind + Docker template

Tento repozitář obsahuje základní šablonu pro fullstack aplikaci:
- **Backend**: Django (modulární monolit)
- **Frontend**: Next.js (React) s TailwindCSS
- **Orchestrace**: Docker Compose (Postgres pro DB)
- **Reverse Proxy**: Nginx (pouze v produkci)

## Architektura

### Backend (Modulární monolit)
Django backend je strukturován jako modulární monolit s jasným oddělením vrstev:
- `apps/` - Doménové moduly (bounded contexts)
- `services/` - Business logika
- `core/` - Sdílené utility a base třídy

Více detailů v `backend/README.md`.

---

## 🚀 Rychlý start

### Development režim

Pro lokální vývoj s hot reload a debug nástroji:

```powershell
# 1. Zkopírujte development .env
cp .env.dev.example .env

# 2. Spusťte development stack
docker-compose -f docker-compose.dev.yml up --build
```

**Přístupné na:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/
- Django Admin: http://localhost:8000/admin
- PostgreSQL: localhost:5432

**Development funkce:**
- Hot reload pro Python i Next.js
- Django Debug Toolbar
- Detailní logging
- Volume mounts pro live změny kódu

---

### Production režim

Pro produkční deployment s optimalizací:

```powershell
# 1. Zkopírujte production .env
cp .env.prod.example .env

# 2. Upravte .env (SECRET_KEY, hesla, domény)

# 3. Spusťte production stack
docker-compose up --build -d
```

**Přístupné na:**
- Aplikace: http://localhost (přes Nginx)
- Backend: pouze přes Nginx (/api/, /admin/)
- Frontend: pouze přes Nginx

**Production funkce:**
- Multi-stage build pro Next.js (optimalizovaný)
- Gunicorn WSGI server
- Nginx reverse proxy
- Static files serving
- Security headers
- SSL ready (upravte nginx.conf)

---

## 📁 Struktura projektu

```
WEB_Template/
├── backend/
│   ├── apps/              # Doménové moduly
│   │   └── items/
│   ├── config/            # Django settings
│   │   ├── settings.py       # Base settings
│   │   ├── settings_dev.py   # Development
│   │   └── settings_prod.py  # Production
│   ├── core/              # Sdílené utility
│   ├── services/          # Business logika
│   ├── Dockerfile         # Production
│   ├── Dockerfile.dev     # Development
│   └── requirements.txt
├── frontend/
│   ├── pages/
│   ├── styles/
│   ├── Dockerfile         # Production (multi-stage)
│   ├── Dockerfile.dev     # Development
│   └── package.json
├── nginx/
│   └── nginx.conf         # Reverse proxy config
├── docker-compose.yml     # Production
├── docker-compose.dev.yml # Development
├── .env.dev.example
└── .env.prod.example
```

---

## 🔧 Užitečné příkazy

### Django management

```powershell
# Migrace databáze
docker-compose exec backend python manage.py migrate

# Vytvořit superuživatele
docker-compose exec backend python manage.py createsuperuser

# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput

# Django shell
docker-compose exec backend python manage.py shell
```

### Databáze

```powershell
# Připojit se k PostgreSQL
docker-compose exec db psql -U appuser -d appdb_dev

# Backup databáze
docker-compose exec db pg_dump -U appuser appdb_dev > backup.sql

# Restore
cat backup.sql | docker-compose exec -T db psql -U appuser appdb_dev
```

### Logy

```powershell
# Všechny služby
docker-compose logs -f

# Pouze backend
docker-compose logs -f backend

# Pouze frontend
docker-compose logs -f frontend
```

---

## 📝 Poznámky

### Development
- Django používá `settings_dev.py` s DEBUG=True a debug toolbar
- Next.js běží v dev režimu s fast refresh
- PostgreSQL port 5432 je exponován pro lokální přístup
- Volume mounts umožňují live reload

### Production
- Django používá `settings_prod.py` se security nastavením
- Next.js je built jako standalone optimalizovaný bundle
- Nginx slouží jako reverse proxy a load balancer
- Služby komunikují pouze přes Docker network (nejsou exponované přímo)
- Pro SSL upravte `nginx/nginx.conf` a přidejte certifikáty

### Bezpečnost
- Změňte `DJANGO_SECRET_KEY` v produkci
- Nastavte silná hesla pro databázi
- Upravte `ALLOWED_HOSTS` na vaše domény
- Zvažte použití `.env` souboru mimo git (už je v `.gitignore`)
- Pro produkci povolte SSL v nginx.conf
