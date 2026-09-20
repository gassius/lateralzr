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
- `./storage/app/public` → `/var/www/html/public/storage` on nginx (public disk files)
- `./docker/nginx/prod.conf` → nginx config (read-only)
- `.env` via `env_file` (not copied into the image)

The app image **entrypoint** (`docker/app-entrypoint.sh`) runs on every start: it recreates `storage/framework/*` and `storage/logs` on the bind mount, `chown`s them to `www-data`, and symlinks `public/storage`. Queue and scheduler artisan processes are dropped to `www-data` so they cannot recreate `laravel.log` as `root:root`.

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

# Production LLM: OpenRouter via laravel/ai (not Ollama)
AI_DEFAULT_PROVIDER=openrouter
OPENROUTER_API_KEY=<your-openrouter-key>
OPENROUTER_DEFAULT_MODEL=openai/gpt-4o-mini

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

### 6. Create a Filament admin (required for `/admin`)

Do **not** use `php artisan make:filament-user` alone. That command creates a user with **no Spatie roles**. `User::canAccessPanel()` requires `super_admin`, so Filament then shows “These credentials do not match our records.” even when the password is correct. `RoleSeeder` is the source of truth for the `super_admin` / `web` role; the commands below call the same `firstOrCreate` logic, so they work even when seeders have never been run in production.

Create or update an admin (hashes the password and assigns `super_admin`):

```bash
./bin/artisan users:create-filament-admin you@example.com --name="Your Name" --password='choose-a-strong-password'
```

Promote an existing user (for example after a bare `make:filament-user`, or a prod user whose `roles` are empty):

```bash
./bin/artisan users:promote-filament-admin you@example.com
```

Do **not** run `db:seed` in production. `AdminUserSeeder` only creates `test@lateralzr.com` when `APP_ENV=local`.

### 7. Start Services, then Optimize Laravel

Caches must be written into **running** containers (`exec`). `run --rm` discards `bootstrap/cache` writes when the ephemeral container exits.

```bash
docker compose -f docker-compose.prod.yml up -d

docker compose -f docker-compose.prod.yml exec -T -u www-data app php artisan config:cache
docker compose -f docker-compose.prod.yml exec -T -u www-data app php artisan route:cache
docker compose -f docker-compose.prod.yml exec -T -u www-data app php artisan view:cache
docker compose -f docker-compose.prod.yml exec -T -u www-data queue php artisan config:cache
docker compose -f docker-compose.prod.yml exec -T -u www-data scheduler php artisan config:cache
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

**Client GTM container IDs** (not secrets; baked into public JS — never commit real values):

| Variable | Where |
|------------|-------------|
| `EXPO_PUBLIC_GTM_WEB` | Vercel Production / Preview (dashboard) — web via Git integration |
| `EXPO_PUBLIC_GTM_ANDROID` | GitHub Environment `prod` (or EAS later) — native only |
| `EXPO_PUBLIC_GTM_IOS` | GitHub Environment `prod` (or EAS later) — native only |

See `VERCEL_DEPLOYMENT.md` for Expo web deploys (Vercel Git integration; no Actions client deploy workflow).

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

Filament / Laravel **web** 500s must show up in **both** places below. If `laravel.log` is quiet, check Docker (PHP-FPM used to swallow worker stderr).

```bash
# Laravel file log (host bind-mount of storage/)
tail -n 200 storage/logs/laravel.log

# PHP-FPM + Laravel stderr (PHP fatals, reportable exceptions)
docker compose -f docker-compose.prod.yml logs --tail=200 app

# All services
docker compose -f docker-compose.prod.yml logs -f

# Queue / scheduler (these also run as www-data)
docker compose -f docker-compose.prod.yml logs --tail=100 queue
docker compose -f docker-compose.prod.yml logs --tail=100 scheduler
```

Confirm PHP error logging inside the running image:

```bash
docker compose -f docker-compose.prod.yml exec -T app php -r 'echo "log_errors=".ini_get("log_errors")." error_log=".ini_get("error_log").PHP_EOL;'
```

Expected: `log_errors=1` and `error_log=/proc/self/fd/2`.

The production log stack is `single` (storage/logs/laravel.log) **plus** `stderr`. `ignore_exceptions` is enabled so a root-owned laravel.log cannot silence docker logs. Emergency fallback is `php://stderr`.

### Run Artisan commands from the VPS host

Do **not** run `php artisan` on the VPS host. The app lives in Docker (`lateralzr_app`), so host PHP would miss `vendor/`, the production `.env` database host (`mysql_db_1`), and the image filesystem.

From `/home/cgonzalez/lateralzr` use the wrapper (preferred):

```bash
./bin/artisan <command>
# or: ./deploy-prod.sh artisan <command>
```

Examples:

```bash
./bin/artisan about
./bin/artisan migrate --force
./bin/artisan schedule:list
./bin/artisan scheduler:test
./bin/artisan users:create-filament-admin you@example.com --name="Your Name" --password='...'
./bin/artisan users:promote-filament-admin you@example.com
./bin/artisan ai:ping --provider=openrouter --dry-run
./bin/artisan ai:ping --provider=openrouter
./bin/artisan concepts:prefetch --provider=openrouter --model=openai/gpt-4o-mini --count=10
./bin/artisan tinker
```

That is a thin wrapper around `docker compose -f docker-compose.prod.yml exec -u www-data app php artisan ...` (or `run --rm` if the app container is down). Interactive commands like `tinker` get a TTY automatically.

Equivalent raw compose (only if you cannot use the wrapper):

```bash
docker compose -f docker-compose.prod.yml exec -u www-data app php artisan <command>
```

### Laravel scheduler (no host crontab)

Host cron cannot see Laravel inside the container. Production does **not** use the VPS crontab. `docker-compose.prod.yml` runs a dedicated `scheduler` service (`lateralzr_scheduler`) with:

```text
php artisan schedule:work --verbose
```

That process invokes `schedule:run` every minute inside the image. Scheduled tasks are defined in `routes/console.php` (Laravel 12). `App\Console\Kernel` is not used.

A heartbeat task `scheduler:test` runs every 15 minutes and logs:

```text
Scheduler Test ran at HH:MM:SS on DD/MM/YYYY
```

Check that it is running:

```bash
./bin/artisan schedule:list
docker compose -f docker-compose.prod.yml logs -f scheduler
tail -f storage/logs/laravel.log
tail -f storage/logs/scheduler-test.log
```

`storage/` is bind-mounted from the VPS checkout, so those log files are on the host.

### Access Application Shell

```bash
docker compose -f docker-compose.prod.yml exec app sh
# or: ./deploy-prod.sh shell
```

### Restart Services

```bash
# Restart all services
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart queue
```

## AI / OpenRouter (concept graph queue)

Production prefetch (`concepts:prefetch` and Filament "Prefetch concept graph") runs on the `queue` worker through `GenerateConceptGraphJob` → `ConceptsOnlyAgent` → laravel/ai OpenRouter driver. Do **not** point production at Ollama.

**VPS `.env` (required):**

```env
AI_DEFAULT_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_DEFAULT_MODEL=openai/gpt-4o-mini
```

- `OPENROUTER_DEFAULT_MODEL` must be a real OpenRouter model id from https://openrouter.ai/models (example: `openai/gpt-4o-mini`). Invented slugs such as `deepseek/deepseek-v4-flash-0731` return HTTP 404.
- Empty `OPENROUTER_DEFAULT_MODEL` falls back to `openai/gpt-4o-mini`.
- Do **not** set `OPENROUTER_BASE_URL` to `https://openrouter.ai/api/v1/chat/completions`. laravel/ai 0.1 config is `driver` + `key` only; Prism already uses base `https://openrouter.ai/api/v1`.

After changing AI env vars:

```bash
./bin/artisan config:cache
docker compose -f docker-compose.prod.yml exec -T -u www-data queue php artisan config:cache
docker compose -f docker-compose.prod.yml restart queue
```

**Sanity check from the VPS (no host `php artisan`):**

```bash
./bin/artisan ai:ping --provider=openrouter --dry-run
./bin/artisan ai:ping --provider=openrouter
./bin/artisan concepts:prefetch --provider=openrouter --model=openai/gpt-4o-mini --count=10 --batch-size=5
docker compose -f docker-compose.prod.yml logs --tail=100 queue
```

Queue workers retry transient OpenRouter timeouts/429/5xx a few times, then stop. Invalid model ids and structured-output schema errors fail immediately with a clear `error_message` on the run job (Filament Concept Graph Runs).

### Queue Management

```bash
# Monitor queue jobs
docker compose -f docker-compose.prod.yml exec -u www-data app php artisan queue:monitor

# Clear failed jobs
docker compose -f docker-compose.prod.yml exec -u www-data app php artisan queue:flush

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
- **HTTPS**: Automatic via Let's Encrypt (uses the platform's `resolver0` certresolver)
- **HTTP → HTTPS**: Automatic redirect via `redirect_http_to_https@docker` middleware

No manual Traefik configuration is needed; the labels handle everything.

> **Note**: The shared gonzalezrico Traefik ACME resolver is named `resolver0`, not `letsencrypt`. The `docker-compose.prod.yml` labels must reference `certresolver=resolver0` to obtain a valid Let's Encrypt certificate.

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

The host `./storage` bind-mount hides the image's storage tree. The **app entrypoint** (not a one-off `chown` on the VPS) is the durable fix:

- Creates `storage/framework/{cache/data,sessions,testing,views}` and `storage/logs` if missing
- `chown www-data:www-data` and `chmod ug+rwX` so PHP-FPM workers can compile Blade views and append laravel.log
- Symlinks `public/storage` → `storage/app/public` (shown by `php artisan about`)

Queue and scheduler also use that entrypoint and run artisan **as www-data**, so they cannot recreate `storage/logs/laravel.log` as `root:root`.

After a deploy you should see:

```bash
ls -ld storage/logs storage/framework/views
# drwxrwxr-x www-data www-data ...
```

Manual repair is only needed if you skip a rebuild/restart:

```bash
docker compose -f docker-compose.prod.yml exec app chown -R www-data:www-data /var/www/html/storage
docker compose -f docker-compose.prod.yml exec app chmod -R ug+rwX /var/www/html/storage
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
docker compose -f docker-compose.prod.yml exec -T -u www-data app php artisan config:cache
docker compose -f docker-compose.prod.yml exec -T -u www-data app php artisan route:cache
docker compose -f docker-compose.prod.yml exec -T -u www-data app php artisan view:cache
docker compose -f docker-compose.prod.yml exec -T -u www-data queue php artisan config:cache
docker compose -f docker-compose.prod.yml exec -T -u www-data scheduler php artisan config:cache
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
   docker compose -f docker-compose.prod.yml exec -u www-data app php artisan db:show
   ```

### Permission Errors

The entrypoint should fix this on every container start. If you still see `Permission denied` writing `storage/logs/laravel.log` or compiled views:

```bash
docker compose -f docker-compose.prod.yml exec app chown -R www-data:www-data /var/www/html/storage
docker compose -f docker-compose.prod.yml restart app queue scheduler
```

### Filament `/admin/login` 500 (intermittent)

`/api/hello` can work while `/admin/login` (and sometimes `/up`) 500s: the hello endpoint is JSON and does not compile Blade views or start a web session the way Filament/Livewire does.

Typical causes in this Docker setup, all hardened in-repo:

| Cause | What happens | Durable fix |
| --- | --- | --- |
| Bind-mount missing `storage/framework/views` | Blade: "Please provide a valid cache path" | Entrypoint + `EnsureApplicationStorage` middleware |
| `storage/logs` owned `root:root` | PHP-FPM (`www-data`) cannot append laravel.log; queue (was root) still can | Entrypoint `chown`; artisan as `www-data` |
| PHP `log_errors=Off`, FPM `catch_workers_output=no` | Fatals never reach `docker compose logs app` | `docker/php/zz-logging.ini` + `zz-fpm-logging.conf` |
| Missing `public/storage` link | `artisan about` reports not linked; public disk 404s | Entrypoint `ln -sfn` + nginx mount |
| Nginx regex location for `*.js` | Livewire `/livewire/*.js` served as static 404 | `try_files` fallback + `^~ /livewire/` |
| Empty `APP_KEY` | EncryptCookies / session 500 | `bin/deploy-prod` refuses to deploy |

Where to look when it 500s:

```bash
curl -i https://api.lateralzr.com/admin/login
docker compose -f docker-compose.prod.yml logs --tail=200 app
tail -n 200 storage/logs/laravel.log
./bin/artisan about
```

Do **not** turn `APP_DEBUG=true` on the public VPS. Rebuild/redeploy this image instead.

### Filament login: “These credentials do not match our records.”

If the password is correct, the user is almost certainly missing the `super_admin` role (or the `roles` table was never seeded). Filament maps a failed `canAccessPanel()` check to the same generic login error.

```bash
./bin/artisan users:promote-filament-admin you@example.com
# or create/reset:
./bin/artisan users:create-filament-admin you@example.com --name="Your Name" --password='choose-a-strong-password'
```

Do not weaken `canAccessPanel()` to allow every user.

### Queue Not Processing Jobs

```bash
# Check queue worker is running
docker compose -f docker-compose.prod.yml ps queue

# View queue logs
docker compose -f docker-compose.prod.yml logs -f queue

# Manually process queue
docker compose -f docker-compose.prod.yml exec -u www-data app php artisan queue:work --once --timeout=300
```

### Concept graph jobs fail against OpenRouter

Most failures are **invalid model id** or **structured-output schema**, not a missing driver.

```bash
./bin/artisan ai:ping --provider=openrouter --dry-run
./bin/artisan ai:ping --provider=openrouter
docker compose -f docker-compose.prod.yml logs --tail=200 queue
```

| Symptom | Fix |
| --- | --- |
| `array schema missing items` / `Invalid schema for response_format` | Deploy this schema fix (`ConceptGraphStructuredSchema` uses `array()->items(...)`). Recycle queue. |
| HTTP 404 / `No endpoints found` for the model | Set `OPENROUTER_DEFAULT_MODEL` to a listed id (`openai/gpt-4o-mini`). Do not invent slugs. |
| cURL timeout / 429 / 502–504 | Transient; jobs retry a few times. If persistent, check OpenRouter status and VPS egress. |
| `Unknown AI provider` | `--provider=openrouter` (CLI help used to omit it). |

After env changes: `./bin/artisan config:cache`, cache config in the queue container, `docker compose -f docker-compose.prod.yml restart queue`.

### Clear All Caches

```bash
docker compose -f docker-compose.prod.yml exec -u www-data app php artisan cache:clear
docker compose -f docker-compose.prod.yml exec -u www-data app php artisan config:clear
docker compose -f docker-compose.prod.yml exec -u www-data app php artisan route:clear
docker compose -f docker-compose.prod.yml exec -u www-data app php artisan view:clear
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

# Laravel health
curl -i https://api.lateralzr.com/up

# Admin login (Filament guest page — expect HTTP 200)
curl -i https://api.lateralzr.com/admin/login
```

## Support

For issues:
- Check logs: `docker compose -f docker-compose.prod.yml logs`
- Review [README.md](README.md) for development setup
- Check ClickUp task: https://app.clickup.com/t/869f2hccq
