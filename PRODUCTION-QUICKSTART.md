# Production Deployment - Quick Reference

## Prerequisites Checklist
- [ ] Docker and Docker Compose installed on VPS
- [ ] Traefik running (part of gonzalezrico stack)
- [ ] MySQL database `lateralzr` exists with credentials
- [ ] DNS `api.lateralzr.com` → VPS IP
- [ ] Repository cloned to `/home/cgonzalez/lateralzr`

## First-Time Setup

```bash
cd /home/cgonzalez/lateralzr

# 1. Configure environment
cp .env.production.example .env
# Edit .env with DB credentials and other secrets

# 2. Generate app key
docker compose -f docker-compose.prod.yml run --rm app php artisan key:generate --show
# Copy output to .env as APP_KEY

# 3. Deploy
./deploy-prod.sh deploy
```

## Regular Deployment

```bash
cd /home/cgonzalez/lateralzr
./deploy-prod.sh deploy
```

## Quick Commands

```bash
./deploy-prod.sh status    # Check services
./deploy-prod.sh logs      # View logs
./deploy-prod.sh restart   # Restart all
./deploy-prod.sh shell     # Enter app container
./deploy-prod.sh artisan <command>  # Run artisan in the app container
./deploy-prod.sh test      # Test API endpoint

# Preferred artisan wrapper (same as deploy-prod.sh artisan):
./bin/artisan migrate --force
./bin/artisan schedule:list
./bin/artisan scheduler:test
```

Do not run `php artisan` on the VPS host. The scheduler is the `lateralzr_scheduler` container (`schedule:work`), not host cron. Heartbeat logs every 15 minutes: `storage/logs/laravel.log` and `storage/logs/scheduler-test.log`.

## Architecture

```
┌─────────────────────────────────────────┐
│  Traefik (gonzalezrico)                 │
│  - HTTPS termination                    │
│  - Routes api.lateralzr.com → nginx     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  lateralzr_nginx                        │
│  - Static files                         │
│  - Proxies PHP requests → app:9000      │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  lateralzr_app (PHP-FPM)                │
│  - Laravel application                  │
│  - Connects to mysql_db_1               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  lateralzr_queue                        │
│  - Background job processing            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  lateralzr_scheduler                    │
│  - Laravel task scheduler               │
└─────────────────────────────────────────┘

Network: gonzalezrico_platform (external)
Database: mysql_db_1 (external)
```

## Environment Variables

Key settings in production `.env`:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.lateralzr.com

DB_HOST=mysql_db_1
DB_DATABASE=lateralzr
DB_USERNAME=lateralzr
DB_PASSWORD=<secret>
```

## Troubleshooting

**Service won't start?**
```bash
docker compose -f docker-compose.prod.yml logs
docker network ls | grep gonzalezrico_platform
```

**Database connection failed?**
```bash
docker compose -f docker-compose.prod.yml exec app php artisan db:show
```

**Permission errors?** The image entrypoint chowns `storage/` to `www-data` on start. Confirm:

```bash
docker compose -f docker-compose.prod.yml exec app ls -ld storage/logs
docker compose -f docker-compose.prod.yml logs --tail=100 app
tail -n 100 storage/logs/laravel.log
```

**Filament `/admin/login` 500?** See [DEPLOYMENT.md](DEPLOYMENT.md) "Filament `/admin/login` 500". Check **docker logs** as well as `laravel.log` — PHP-FPM used to drop fatals.

**Queue not working?**
```bash
docker compose -f docker-compose.prod.yml logs queue
docker compose -f docker-compose.prod.yml restart queue
```

## See Full Documentation
[DEPLOYMENT.md](DEPLOYMENT.md)
