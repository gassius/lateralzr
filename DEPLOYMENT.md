# Lateralzr API - Production Deployment

This guide covers deploying the Lateralzr Laravel API to a production environment on the Hetzner VPS alongside the gonzalezrico project, using shared Traefik reverse proxy and MySQL database.

> **⚠️ Important**: This deployment stack is completely independent of the gonzalezrico project. All deployment operations are scoped to `/home/cgonzalez/lateralzr` and use only `docker-compose.prod.yml`. The GitHub Actions workflow and deployment scripts **never** touch the gonzalezrico compose stack.

## Deployment Methods

### 1. GitHub Actions (Recommended)

Automated deployment via GitHub Actions runs on every push to `main` or can be triggered manually.

**Prerequisites**:
- GitHub repository secrets configured (see [GitHub Actions Setup](#github-actions-setup))
- Initial server setup completed (see [Initial Setup](#initial-setup))

**How it works**:
1. Push to `main` branch triggers the workflow
2. GitHub Actions SSHes to the VPS at `/home/cgonzalez/lateralzr`
3. Runs `bin/deploy-prod` script (dirty-tree guard, fetch, build, migrate, compose up, optimize)
4. Verifies deployment and API health

**Manual trigger**:
Go to Actions → Deploy to Production → Run workflow

### 2. Manual Deployment

SSH to the VPS and run the deployment script directly:

```bash
ssh cgonzalez@<vps-host>
cd /home/cgonzalez/lateralzr
./bin/deploy-prod
```

The `bin/deploy-prod` script:
- Guards against uncommitted changes (dirty tree)
- Fetches and pulls latest from git
- Builds Docker images (`docker-compose.prod.yml` only)
- Runs migrations
- Starts services, then optimizes Laravel caches inside running containers
- Restarts services with zero-downtime

## Architecture Overview

The production setup consists of:

- **nginx** (`lateralzr_nginx:prod`) - Web server with `public/` baked from the app image; Traefik labels for HTTPS
- **app** (`lateralzr_app:prod`) - PHP-FPM; application code and `vendor/` live **in the image**
- **queue** - Background job worker (same app image)
- **scheduler** - Laravel's task scheduler (same app image)

Volumes (intentionally narrow — do **not** bind-mount the host repo over `/var/www/html`):

- `./storage` → `/var/www/html/storage` on app/queue/scheduler (writable uploads, logs, cache)
- `./docker/nginx/prod.conf` → nginx config (read-only)
- `.env` via `env_file` (not copied into the image)

A full-repo bind-mount would hide image `vendor/` and `public/build` (the VPS checkout typically has neither).

All services connect to:
- Shared **MySQL** (`mysql_db_1`) on the `gonzalezrico_platform` network
- Shared **Traefik** reverse proxy for HTTPS termination and routing

## Prerequisites

- Docker and Docker Compose installed on the VPS
- Traefik running and configured (part of gonzalezrico stack)
- MySQL database `lateralzr` with user credentials
- DNS record for `api.lateralzr.com` pointing to the VPS
- Repository cloned to `/home/cgonzalez/lateralzr`
- For GitHub Actions: Environment secrets configured in GitHub repository

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

### 7. Start Services, then Optimize Laravel

Caches must be written into **running** containers (`exec`). `run --rm` discards `bootstrap/cache` writes when the ephemeral container exits.

```bash
docker compose -f docker-compose.prod.yml up -d

docker compose -f docker-compose.prod.yml exec -T app php artisan config:cache
docker compose -f docker-compose.prod.yml exec -T app php artisan route:cache
docker compose -f docker-compose.prod.yml exec -T app php artisan view:cache
docker compose -f docker-compose.prod.yml exec -T queue php artisan config:cache
docker compose -f docker-compose.prod.yml exec -T scheduler php artisan config:cache
```

## Deployment

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

## GitHub Actions Setup

### Configuring GitHub Environment Secrets

The automated deployment workflow requires a GitHub environment named `prod` with the following secrets:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Environments** → **New environment**
3. Name it `prod`
4. Add the following secrets:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `PROD_HOST` | VPS hostname or IP address | `your-vps.com` or `1.2.3.4` |
| `PROD_USER` | SSH username on the VPS | `cgonzalez` |
| `PROD_SSH_KEY` | Private SSH key for authentication | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `PROD_PORT` | SSH port (default 22) | `22` |
| `PROD_PATH` | Absolute path to lateralzr on VPS | `/home/cgonzalez/lateralzr` |

**Generating the SSH key** (if needed):

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-lateralzr" -f ~/.ssh/lateralzr_deploy

# Copy the public key to the VPS
ssh-copy-id -i ~/.ssh/lateralzr_deploy.pub cgonzalez@<vps-host>

# Copy the private key content for GitHub secret
cat ~/.ssh/lateralzr_deploy
```

Paste the **entire private key** (including `-----BEGIN` and `-----END` lines) into the `PROD_SSH_KEY` secret.

### First Deployment vs Recurring Deployments

**First-time deployment**:
1. Complete [Initial Setup](#initial-setup) manually via SSH (clone repo, create `.env`, run migrations, etc.)
2. Configure GitHub environment secrets
3. Push to `main` or trigger workflow manually

**Recurring deployments** (after initial setup):
- Simply push to `main` or trigger the workflow
- The GitHub Action will automatically pull, build, migrate, and deploy

### Workflow File

The workflow is defined in `.github/workflows/deploy-prod.yml` and:
- Triggers on push to `main` or manual dispatch
- SSHes to the VPS and runs `bin/deploy-prod`
- Verifies deployment by checking service status and API health
- Fails if uncommitted changes exist on the server (dirty tree guard)

## Updates and Maintenance

### Deploying Updates

**Via GitHub Actions** (recommended):
```bash
git push origin main
```
The workflow handles everything automatically.

**Manually via SSH**:
```bash
ssh cgonzalez@<vps-host>
cd /home/cgonzalez/lateralzr
./bin/deploy-prod
```

The `bin/deploy-prod` script performs:
1. Dirty tree guard (refuses to deploy with uncommitted changes)
2. Git fetch and pull
3. Docker build
4. Database migrations
5. Laravel cache optimization
6. Service restart (`docker-compose.prod.yml` only)

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

## Disk space and maintenance

Production deploys need free space for `git pull`, Docker layer downloads, and `Dockerfile.prod` builds (Composer, pnpm, apt packages). On a small VPS, Docker **build cache**, **old image layers**, and **container logs** accumulate quickly. Before PR #4, `docker-compose.prod.yml` triggered **three parallel builds** of the same image (`app`, `queue`, `scheduler`), which temporarily tripled peak disk use during deploy.

**Check space before deploy** (also runs automatically in `bin/deploy-prod`):

```bash
./bin/deploy-disk-check.sh
# Default minimum: 3GB free (override with DEPLOY_MIN_FREE_GB=5)
```

**Conservative cleanup** (does not remove named volumes used by gonzalezrico/MySQL):

```bash
./bin/deploy-cleanup-docker
# or: ./deploy-prod.sh cleanup-docker
```

If `git pull` fails with **No space left on device**, SSH to the VPS, run cleanup above, then `git pull` and `./bin/deploy-prod`. To bypass the deploy guard in an emergency: `SKIP_DISK_CHECK=1 ./bin/deploy-prod` (only after freeing space).

## Troubleshooting

### Build hangs after “exporting to image” / “DONE”

Compose v2.37+ may use **buildx bake** by default. Bake (and related BuildKit post-export work) can leave the CLI hung after the image is already written (`naming to ... lateralzr_app:prod done`). Multiple Ctrl+C then prints `forcing shutdown`, and older deploy scripts mislabeled that as “Docker build failed”.

`bin/deploy-prod` now builds via `bin/build-prod-image` with `COMPOSE_BAKE=false`, builds `app` + `nginx`, and verifies `lateralzr_app:prod` and `lateralzr_nginx:prod` exist before migrate/up.

**Interim (images already built, no lateralzr containers):**

```bash
cd /home/cgonzalez/lateralzr
docker image inspect lateralzr_app:prod lateralzr_nginx:prod   # confirm images exist
docker compose -f docker-compose.prod.yml run --rm app php artisan migrate --force
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker compose -f docker-compose.prod.yml exec -T app php artisan config:cache
docker compose -f docker-compose.prod.yml exec -T app php artisan route:cache
docker compose -f docker-compose.prod.yml exec -T app php artisan view:cache
docker compose -f docker-compose.prod.yml exec -T queue php artisan config:cache
docker compose -f docker-compose.prod.yml exec -T scheduler php artisan config:cache
docker compose -f docker-compose.prod.yml ps
curl -fsS https://api.lateralzr.com/api/hello
```

Do **not** run `docker compose ... down` on other stacks; stay on `docker-compose.prod.yml` only.

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

## Separation from gonzalezrico

The Lateralzr deployment is **completely isolated** from the gonzalezrico project:

- **Different paths**: `/home/cgonzalez/lateralzr` vs `/home/cgonzalez/gonzalezrico`
- **Different compose files**: `docker-compose.prod.yml` (lateralzr) vs gonzalezrico's compose stack
- **Different containers**: `lateralzr_*` prefix vs `gonzalezrico_*` prefix
- **Shared network only**: Both connect to `gonzalezrico_platform` for Traefik and MySQL access
- **Independent deployments**: Deploying Lateralzr never runs `docker compose` commands in the gonzalezrico directory

The GitHub Actions workflow and `bin/deploy-prod` script are scoped to `/home/cgonzalez/lateralzr` and **never touch** the gonzalezrico compose stack.

## Security Considerations

1. **Never expose the production `.env` file** - it contains database passwords and API keys
2. **Keep APP_DEBUG=false** in production to avoid leaking sensitive information
3. **Use strong passwords** for database and admin accounts
4. **Regularly update dependencies**: `composer update` (test in staging first)
5. **Monitor logs** for suspicious activity
6. **Keep Docker images updated**: rebuild periodically with `./bin/build-prod-image` (or `./deploy-prod.sh build`)
7. **Protect GitHub secrets**: Only grant repository access to trusted collaborators; the `PROD_SSH_KEY` provides full SSH access to the VPS

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
