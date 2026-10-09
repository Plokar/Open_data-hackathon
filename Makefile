.PHONY: help dev up down restart seed reset logs test build prod-up prod-logs prod-demo backup

COMPOSE_DEV = docker compose -f docker-compose.dev.yml

help: ## Zobrazí nápovědu pro dostupné příkazy
	@echo "=========================================================="
	@echo "  ZÁPAD GO – Rychlé příkazy"
	@echo "=========================================================="
	@echo "  make dev      - Spustí kompletní stack v dev módu s logy"
	@echo "  make up       - Spustí stack na pozadí (-d)"
	@echo "  make down     - Zastaví všechny běžící kontejnery"
	@echo "  make restart  - Restartuje kontejnery"
	@echo "  make seed     - Naplní databázi ukázkovými demo daty"
	@echo "  make reset    - Kompletní reset DB + nové migrace + seed"
	@echo "  make logs     - Zobrazí živý výpis logů ze všech služeb"
	@echo "  make test     - Spustí backendové testy (pytest)"
	@echo "  make build    - Přestaví Docker obrazy bez cache"
	@echo "  make prod-up  - VPS: build + start produkce (docker-compose.yml)"
	@echo "  make prod-demo- VPS: staff účty demo1/demo2 (DEMO_PASSWORD)"
	@echo "  make backup   - VPS: záloha DB a fotek do ./backups"
	@echo "=========================================================="

dev: ## Spustí kompletní dev stack
	@if [ ! -f .env ]; then cp .env.dev.example .env; echo "Vytvořen .env"; fi
	$(COMPOSE_DEV) up --build

up: ## Spustí dev stack na pozadí
	@if [ ! -f .env ]; then cp .env.dev.example .env; echo "Vytvořen .env"; fi
	$(COMPOSE_DEV) up --build -d
	@echo "✅ Služby běží na pozadí:"
	@echo "   Frontend: http://localhost:3000"
	@echo "   Backend:  http://localhost:8000/api/"
	@echo "   Mailhog:  http://localhost:8025"

down: ## Zastaví dev stack
	$(COMPOSE_DEV) down

restart: down up ## Restartuje stack

seed: ## Naplní DB místy a odznaky z fixture
	$(COMPOSE_DEV) exec backend python manage.py loaddata places badges

reset: ## Resetuje DB volume, provede migrace a naseeduje demo data
	$(COMPOSE_DEV) down -v
	$(COMPOSE_DEV) up --build -d
	@echo "⏳ Čekám na start databáze..."
	@sleep 5
	$(COMPOSE_DEV) exec backend python manage.py migrate
	$(COMPOSE_DEV) exec backend python manage.py loaddata places badges
	@echo "✅ Databáze resetována a naseedována!"

logs: ## Sleduje logy
	$(COMPOSE_DEV) logs -f

test: ## Spustí backend testy
	$(COMPOSE_DEV) exec backend pytest

build: ## Přestaví kontejnery bez cache
	$(COMPOSE_DEV) build --no-cache

prod-up: ## VPS: build a start produkce
	@test -f .env || (echo "Chybí .env – cp .env.prod.example .env a vyplnit" && exit 1)
	docker compose up -d --build
	docker compose ps

prod-logs: ## VPS: logy backendu
	docker compose logs -f backend

prod-demo: ## VPS: demo účty pro pódium
	docker compose exec backend python manage.py seed_demo

backup: ## VPS: záloha DB + fotek
	./scripts/backup.sh
