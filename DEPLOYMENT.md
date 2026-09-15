# Lateralzr API - Production Deployment

This guide covers deploying the Lateralzr Laravel API to a production environment on the Hetzner VPS alongside the gonzalezrico project, using shared Traefik reverse proxy and MySQL database.

## Architecture Overview

The production setup consists of:

- **nginx** - Web server exposing the Laravel API via Traefik
- **app** - PHP-FPM container running the Laravel application
- **queue** - Background job worker for async tasks
- **scheduler** - Laravel's task scheduler for cron jobs

All services connect to:
- Shared **MySQL** (`mysql_db_1`) on the `gonzalezrico_platform` network
- Shared **Traefik** reverse proxy for HTTPS termination and routing

## Prerequisites

- Docker and Docker Compose installed on the VPS
- Traefik running and configured (part of gonzalezrico stack)
- MySQL database `lateralzr` with user credentials
- DNS record for `api.lateralzr.com` pointing to the VPS
- Repository cloned to `/home/cgonzalez/lateralzr`

## Initial Setup

### 1. Clone Repository (if not already done)

```bash
cd /home/cgonzalez
git clone https://github.com/gassius/lateralzr.git
cd lateralzr
```

### 2. Configure Environment

Create a production `.env` file from the template:

```bash
cp .env.production.example .env
```

**Critical environment variables to set:**

```env
APP_KEY=                 # Generate with: docker compose -f docker-compose.prod.yml run --rm app php artisan key:generate --show
APP_DEBUG=false
APP_ENV=production
APP_URL=https://api.lateralzr.com

DB_HOST=mysql_db_1
DB_DATABASE=lateralzr
DB_USERNAME=lateralzr
DB_PASSWORD=<your-mysql-password>

# Set appropriate mail driver for production
MAIL_MAILER=smtp
MAIL_HOST=<your-smtp-host>
MAIL_PORT=587
MAIL_USERNAME=<your-smtp-username>
MAIL_PASSWORD=<your-smtp-password>
MAIL_FROM_ADDRESS=noreply@lateralzr.com
```

⚠️ **Never commit `.env` to git** - it contains production secrets.

### 3. Build Docker Images

```bash
docker compose -f docker-compose.prod.yml build
```

### 4. Generate Application Key (if not already set)

```bash
docker compose -f docker-compose.prod.yml run --rm app php artisan key:generate --show
```

Copy the output and add it to your `.env` as `APP_KEY`.

### 5. Run Database Migrations

```bash
docker compose -f docker-compose.prod.yml run --rm app php artisan migrate --force
```

### 6. Seed Database (optional, for initial admin user)

```bash
docker compose -f docker-compose.prod.yml run --rm app php artisan db:seed --force
```

Note: The seeder creates a test admin user (`test@lateralzr.com`) only in `local` environment by default. For production, create admin users manually or adjust the seeder.

### 7. Optimize Laravel

```bash
docker compose -f docker-compose.prod.yml run --rm app php artisan config:cache
docker compose -f docker-compose.prod.yml run --rm app php artisan route:cache
docker compose -f docker-compose.prod.yml run --rm app php artisan view:cache
```

## Deployment

### Start Services

```bash
docker compose -f docker-compose.prod.yml up -d
```

This will start:
- `lateralzr_nginx` - Web server (accessible via Traefik at https://api.lateralzr.com)
- `lateralzr_app` - PHP-FPM application
- `lateralzr_queue` - Background job worker
- `lateralzr_scheduler` - Task scheduler

### Verify Services

```bash
# Check all containers are running
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Test the API
curl https://api.lateralzr.com/api/hello
```

Expected response:
```json
{
  "message": "Hello, Lateralzr API is running!",
  "status": "ok"
}
```

## Updates and Maintenance

### Deploying Updates

```bash
# Pull latest code
cd /home/cgonzalez/lateralzr
git pull origin main

# Rebuild images (if Dockerfile changed)
docker compose -f docker-compose.prod.yml build

# Stop services
docker compose -f docker-compose.prod.yml down

# Run migrations (if any)
docker compose -f docker-compose.prod.yml run --rm app php artisan migrate --force

# Clear and recache
docker compose -f docker-compose.prod.yml run --rm app php artisan config:clear
docker compose -f docker-compose.prod.yml run --rm app php artisan config:cache
docker compose -f docker-compose.prod.yml run --rm app php artisan route:cache
docker compose -f docker-compose.prod.yml run --rm app php artisan view:cache

# Restart services
docker compose -f docker-compose.prod.yml up -d
```

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f queue
docker compose -f docker-compose.prod.yml logs -f scheduler
```

### Access Application Shell

```bash
docker compose -f docker-compose.prod.yml exec app sh
```

### Restart Services

```bash
# Restart all services
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart queue
```

### Queue Management

```bash
# Monitor queue jobs
docker compose -f docker-compose.prod.yml exec app php artisan queue:monitor

# Clear failed jobs
docker compose -f docker-compose.prod.yml exec app php artisan queue:flush

# Restart queue worker (if you change job code)
docker compose -f docker-compose.prod.yml restart queue
```

## Networking

### Shared Network

All production services connect to the `gonzalezrico_platform` external network, which includes:

- **Traefik** - Reverse proxy handling HTTPS and routing
- **mysql_db_1** - Shared MySQL database server

### Traefik Configuration

The nginx service is configured with Traefik labels in `docker-compose.prod.yml`:

- **Host**: `api.lateralzr.com`
- **HTTPS**: Automatic via Let's Encrypt (`letsencrypt` certresolver)
- **HTTP → HTTPS**: Automatic redirect

No manual Traefik configuration is needed; the labels handle everything.

## Database

The production stack **does not include MySQL** - it uses the existing shared `mysql_db_1` container on the `gonzalezrico_platform` network.

**Database credentials** are configured in `.env`:

```env
DB_HOST=mysql_db_1
DB_DATABASE=lateralzr
DB_USERNAME=lateralzr
DB_PASSWORD=<provided-by-admin>
```

## Storage and Permissions

Laravel's `storage/` directory needs write permissions:

```bash
docker compose -f docker-compose.prod.yml exec app chown -R www-data:www-data /var/www/html/storage
docker compose -f docker-compose.prod.yml exec app chmod -R 755 /var/www/html/storage
```

## Backups

### Database Backup

```bash
# Backup from the mysql_db_1 container
docker exec mysql_db_1 mysqldump -u lateralzr -p lateralzr > backup-$(date +%Y%m%d).sql
```

### Storage Backup

```bash
# Backup uploaded files and logs
tar -czf storage-backup-$(date +%Y%m%d).tar.gz storage/
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check if network exists
docker network ls | grep gonzalezrico_platform

# Verify MySQL is accessible
docker compose -f docker-compose.prod.yml exec app ping mysql_db_1
```

### Database Connection Issues

1. Verify `mysql_db_1` is running: `docker ps | grep mysql`
2. Check `.env` credentials match database setup
3. Test connection from app container:
   ```bash
   docker compose -f docker-compose.prod.yml exec app php artisan db:show
   ```

### Permission Errors

```bash
docker compose -f docker-compose.prod.yml exec app chown -R www-data:www-data /var/www/html/storage
docker compose -f docker-compose.prod.yml exec app chown -R www-data:www-data /var/www/html/bootstrap/cache
```

### Queue Not Processing Jobs

```bash
# Check queue worker is running
docker compose -f docker-compose.prod.yml ps queue

# View queue logs
docker compose -f docker-compose.prod.yml logs -f queue

# Manually process queue
docker compose -f docker-compose.prod.yml exec app php artisan queue:work --once
```

### Clear All Caches

```bash
docker compose -f docker-compose.prod.yml exec app php artisan cache:clear
docker compose -f docker-compose.prod.yml exec app php artisan config:clear
docker compose -f docker-compose.prod.yml exec app php artisan route:clear
docker compose -f docker-compose.prod.yml exec app php artisan view:clear
```

## Local Development

The production Docker setup **does not affect** local development with Laravel Sail.

- **Local development**: Use `./sail up` or `docker compose up` (uses `compose.yaml`)
- **Production**: Use `docker compose -f docker-compose.prod.yml up -d`

Both configurations can coexist - they use different compose files and don't interfere with each other.

## Security Considerations

1. **Never expose the production `.env` file** - it contains database passwords and API keys
2. **Keep APP_DEBUG=false** in production to avoid leaking sensitive information
3. **Use strong passwords** for database and admin accounts
4. **Regularly update dependencies**: `composer update` (test in staging first)
5. **Monitor logs** for suspicious activity
6. **Keep Docker images updated**: rebuild periodically with `docker compose -f docker-compose.prod.yml build --pull`

## Health Checks

Test endpoints:

```bash
# Basic health check
curl https://api.lateralzr.com/api/hello

# Admin panel (requires login)
curl https://api.lateralzr.com/admin
```

## Support

For issues:
- Check logs: `docker compose -f docker-compose.prod.yml logs`
- Review [README.md](README.md) for development setup
- Check ClickUp task: https://app.clickup.com/t/869f2hccq
