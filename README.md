# Lateralzr API

A Laravel 12 API server for **Lateralzr** - an application designed to improve lateral thinking skills, inspired by Edward de Bono's lateral thinking concepts and Brian Eno's Oblique Strategies card set.

## Project Overview

Lateralzr aims to help users develop lateral thinking abilities by presenting concepts and allowing users to explore lateralized (non-linear) relationships between ideas. The API serves as the backend that provides concepts and their relationships, with LLM integration for generating new concepts and connections.

### What is Lateral Thinking?

Lateral thinking, as defined by Edward de Bono, is a method of problem-solving that uses indirect and creative approaches. Unlike vertical (logical) thinking, lateral thinking involves looking at problems from new angles and finding unexpected solutions.

## Tech Stack

- **Framework**: Laravel 12
- **Development Environment**: Laravel Sail (Docker)
- **AI Integration**: Laravel AI SDK with Ollama (local LLM)
- **AI Development Tools**: Laravel Boost (MCP/Agent integration)
- **Database**: MySQL (via Sail)
- **Testing**: PHPUnit

## Prerequisites

- Docker Desktop installed and running
- Git
- Composer (optional - Sail includes it)
- **Node.js** (see [.nvmrc](.nvmrc); e.g. Node 20) and **pnpm** (package manager for the monorepo). Use [NVM](https://github.com/nvm-sh/nvm) on the host: `nvm use` in the repo root; install pnpm via `corepack enable && corepack prepare pnpm@latest --activate` or [pnpm.io](https://pnpm.io/installation). Optional: run the client via the Node Docker service (see [Monorepo](#monorepo)).
- Ollama installed on macOS (for local LLM development)
  - See [02-local-llm-and-ai-sdk_daf470d7.plan.md](.cursor/plans/02-local-llm-and-ai-sdk_daf470d7.plan.md) for installation instructions

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd lateralzr-api
```

### 2. Set Up Environment

Copy the environment file and configure it:

```bash
cp .env.example .env
```

Update `.env` with your configuration (Sail will handle most Docker-related settings automatically).

### 3. Start Laravel Sail

Start the Docker containers:

```bash
./sail up -d
```

The repository includes a root `./sail` wrapper for `./vendor/bin/sail`. You may also use the long form directly:

```bash
./vendor/bin/sail up -d
```

Do not run Laravel backend commands directly on the host with `php artisan` or `composer`; the `.env` database host is configured for Sail containers.

### 4. Generate Application Key

```bash
./sail artisan key:generate
```

### 5. Run Migrations and Seed (optional)

```bash
./sail artisan migrate
./sail artisan db:seed   # Seeds roles and, in local, the admin user test@lateralzr.com
```

### 6. Start Development Environment

Use the development script to start Ollama (if needed) and Laravel Sail:

```bash
./dev.sh up
```

This will:
- Check if Ollama is running and start it if needed
- Verify the default model (`llama3.2:3b`) is available
- Start Laravel Sail containers

To stop services:

```bash
./dev.sh down        # Stop Sail only
./dev.sh down --all  # Stop Sail and Ollama
```

## Development Workflow

### Running the Application

The API will be available at `http://localhost` (or the port configured in your `.env`).

### Monorepo

This repository is a **monorepo**: the **Laravel API** lives at the **root**; the **Expo client** lives in **`apps/client`**. The **package manager is pnpm** ([pnpm-workspace.yaml](pnpm-workspace.yaml)). [Turborepo](https://turbo.build) orchestrates tasks so the root (Laravel Admin / Vite) and the client (Expo) do not collide: run admin builds from the root, client from `apps/client` or via Turbo.

- **Node version**: Use the version in [.nvmrc](.nvmrc) (e.g. `nvm use` in the repo root) for both Vite and the Expo app. Alternatively, use the optional **Node Docker service** (profile `client`) to run client commands in a container. Ensure pnpm is available (e.g. `corepack enable && corepack prepare pnpm@9.15.0 --activate` in the image or use a pnpm-aware image), then from the repo root:  
  `docker compose --profile client run --rm node sh -c "pnpm install --frozen-lockfile && pnpm turbo run dev --filter=client"`.
- **Run the API**: from the repo root, `./sail up -d` (or `./vendor/bin/sail up -d`, or `./dev.sh up`); see [Installation](#installation).
- **Run the client**: from the repo root, `cd apps/client && pnpm exec expo start`, then choose web (`w`), iOS (`i`), or Android (`a`). Or use Turbo: `pnpm turbo run dev --filter=client` (from root).
- **Independent deployment**: In CI, deploy only the API when changes are outside `apps/client/**`; deploy only the client when changes are under `apps/client/**`.

#### Expo client

- **Prerequisites**: Node version per [.nvmrc](.nvmrc) (NVM on host or Node Docker service); optionally Xcode (iOS) / Android Studio (Android) for native runs.
- **Environment**: Set `EXPO_PUBLIC_API_URL` (e.g. in `apps/client/.env`) to the API base URL (no trailing slash). Example: `EXPO_PUBLIC_API_URL=http://localhost`.
- See [Expo Documentation](https://docs.expo.dev) for building and deploying the app.
- **Test URL params** (Expo web / Critiquito): `canonicalConcept`, `localizedConcept`, `onlyWithMedia`, plus existing `locale`. Docs and example URLs: [apps/client/TEST-URL-PARAMS.md](apps/client/TEST-URL-PARAMS.md).

### Admin Backoffice

A Filament 5 admin panel is available at **`/admin`** for quick inspection and management of data (e.g. Concepts, Users).

- **URL**: `http://localhost/admin` (or your app URL + `/admin`). Production: `https://api.lateralzr.com/admin`.
- **Auth**: Login required. Access is restricted to users with the `super_admin` role (Spatie Laravel Permission).
- **Local seed user** (created only when `APP_ENV=local`):  
  - Email: `test@lateralzr.com`  
  - Password: `!12345678`  
  After running `./sail artisan migrate` and `./sail artisan db:seed`, this user exists in local and can log in to the backoffice.
- **Production**: do not use `make:filament-user` alone (it does not assign `super_admin`). Create or promote an admin with `./bin/artisan users:create-filament-admin {email} --name="..." --password='...'` or `./bin/artisan users:promote-filament-admin {email}`. See [DEPLOYMENT.md](DEPLOYMENT.md).

### Common Sail Commands

```bash
# Start containers
./sail up -d

# Stop containers
./sail stop

# View logs
./sail logs

# Run Artisan commands
./sail artisan <command>

# Process concept graph jobs manually
./sail artisan queue:work --queue=default --timeout=300

# Verify AI provider/model (OpenRouter in prod)
./sail artisan ai:ping --provider=openrouter --dry-run
./sail artisan concepts:prefetch --provider=openrouter --starts=creativity --count=10

# Run Composer commands
./sail composer <command>

# Run tests
./sail test

# Run Pint
./sail pint

# Access container shell
./sail shell

# Access Tinker
./sail tinker
```

### Running Tests

```bash
# Run all tests
./sail test

# Run specific test file
./sail test tests/Feature/ApiHealthTest.php

# Run with coverage
./sail test --coverage
```

## API Endpoints

### Health Check

**GET** `/api/hello`

Returns a simple health check response.

**Response:**
```json
{
  "message": "Hello, Lateralzr API is running!",
  "status": "ok"
}
```

### Media proxy

**GET** `/api/media?url=`

Allowlisted reverse proxy for concept card images. The Expo **web** client loads Wikimedia (and other allowlisted) `mediaUrl`s through this endpoint so display does not depend on third-party CORS. Native clients should keep requesting the original `mediaUrl` directly (Wikimedia is fine there; browsers are not).

Only `https` URLs on `upload.wikimedia.org` with a raster image extension are fetched. SVG is rejected. Responses are cached by browsers (`Cache-Control`) and the route is throttled.

### Generate Concept Relationships

**POST** `/api/concepts/relationships`

Returns a prefetched graph neighborhood. **Cold start**: omit `start` (or send an empty body) to let the API choose a random concept.

Test/dev filters (same names as the Expo web query params; see [apps/client/TEST-URL-PARAMS.md](apps/client/TEST-URL-PARAMS.md)):

- `start` / `seed` / `localizedConcept` — localized (or any-locale) term
- `canonicalStart` / `canonicalConcept` — language-neutral `canonical_key` (use with `locale`)
- `onlyWithMedia` — only concepts that have a `mediaUrl`
- `locale` — `en` or `es`

**Request:**
```json
{
  "seed": "creativity",
  "count": 5,
  "complexity": 2
}
```
- `seed` — optional; when omitted, the API picks a random concept from config or the database.
- `count` — optional (default 3–5 concepts, max 10).
- `complexity` — optional, integer **1–5**: controls **label length** for each `concept` (word caps: 1 = one word, 2 = **max two words**—places, people, short artwork titles; 3–4 = up to 3–4 words; 5 = longer scholarly titles). Default **2** (`CONCEPTS_DEFAULT_COMPLEXITY` in `.env`).

**Response:**
```json
{
  "data": {
    "complexity": 2,
    "seed": {
      "concept": "creativity",
      "shortDescription": "...",
      "wikiUrl": "...",
      "mediaUrl": null
    },
    "related_concepts": [
      {
        "concept": "constraint",
        "shortDescription": "Limitations can spark creative solutions",
        "larelality": 3,
        "wikiUrl": null,
        "mediaUrl": null
      }
    ]
  },
  "status": "success"
}
```

**Note**: Requires Ollama to be running. See [Local LLM Setup](#local-llm-setup) below.

## Project Structure

```
lateralzr-api/
├── app/                    # Laravel application code
│   ├── Http/
│   │   └── Controllers/   # API controllers
│   └── Models/            # Eloquent models
├── apps/
│   └── client/            # Expo client (React Native + TypeScript, Expo Router)
├── config/
│   └── concepts.php       # Default seed concepts (cold start)
├── database/
│   ├── migrations/        # Database migrations
│   └── seeders/           # Database seeders
├── routes/
│   └── api.php            # API routes
├── tests/                 # Test suite
│   └── Feature/           # Feature tests
├── turbo.json             # Turborepo pipeline
├── pnpm-workspace.yaml     # pnpm workspace (apps/*)
├── pnpm-lock.yaml         # pnpm lockfile
├── .nvmrc                  # Node version (e.g. 20)
├── .cursor/plans/         # Project plans
└── compose.yaml           # Docker Compose configuration
```

## Local LLM Setup

This project uses **Ollama** running natively on macOS for local LLM development, integrated via **Laravel AI SDK**. This allows for cost-free development and testing of concept relationship generation.

### Quick Start

1. **Install Ollama** (if not already installed):
   ```bash
   brew install ollama
   # Or download from https://ollama.com/download
   ```

2. **Pull the default model**:
   ```bash
   ollama pull llama3.2:3b
   ```

3. **Start development environment**:
   ```bash
   ./dev.sh up
   ```

4. **Test the concept generation endpoint**:
   ```bash
   curl -X POST http://localhost/api/concepts/relationships \
     -H "Content-Type: application/json" \
     -d '{"seed": "innovation"}'
   ```

### Configuration

The default model (`llama3.2:3b`) can be changed via the `OLLAMA_MODEL` environment variable in `.env`:

```env
OLLAMA_MODEL=llama3.1:8b  # For higher quality (slower)
OLLAMA_MODEL=llama3.2:1b  # For faster responses
```

### Testing

Run tests:
```bash
# Unit and feature tests (mocked)
./sail test

# Smoke tests with real Ollama (requires Ollama running)
AI_SMOKE_TESTS=1 ./sail test --group=ollama
```

For detailed setup instructions, troubleshooting, and model recommendations, see [.cursor/plans/02-local-llm-and-ai-sdk_daf470d7.plan.md](.cursor/plans/02-local-llm-and-ai-sdk_daf470d7.plan.md).

## Laravel Boost Integration

This project uses Laravel Boost for AI agent integration. Boost provides:

- **MCP Tools**: Deep insight into application structure, database, routes
- **AI Guidelines**: Laravel-specific coding guidelines for AI agents
- **Documentation Search**: Access to Laravel ecosystem documentation

Configuration files:
- `boost.json` - Boost configuration
- `.cursorrules/` - Cursor-specific agent rules (if using Cursor)

## Contributing

1. Create a feature branch
2. Make your changes
3. Write or update tests
4. Ensure all tests pass: `./sail test`
5. Submit a pull request

## Testing

This project emphasizes test-driven development. All new features should include:

- Unit tests for business logic
- Feature tests for API endpoints
- Integration tests for complex workflows

Run the test suite:

```bash
./sail test
```

## Production Deployment

For production deployment to the Hetzner VPS with Docker Compose and Traefik, see [DEPLOYMENT.md](DEPLOYMENT.md).

**Automated deployment** (recommended):
- GitHub Actions workflow (`.github/workflows/deploy-prod.yml`)
- Triggers on push to `main` or manual dispatch
- Deploys to `/home/cgonzalez/lateralzr` via SSH

**Manual deployment**:
- SSH to VPS and run `./bin/deploy-prod`
- Includes dirty-tree guard, git fetch/pull, build, migrate, optimize

Quick specs:
- Production stack: `docker-compose.prod.yml`
- Uses shared Traefik reverse proxy and MySQL from `gonzalezrico_platform` network
- Public host: https://api.lateralzr.com
- Services: nginx, app (PHP-FPM), queue worker, scheduler (`php artisan schedule:work` — no VPS crontab)
- On the VPS, run artisan with `./bin/artisan <command>` (never host `php artisan`)
- **Isolated from gonzalezrico**: Deployment never touches the gonzalezrico compose stack

## License

[To be determined]

## Next Steps

- Design database schema for concepts and relationships
- ~~Set up Laravel AI SDK for LLM integration~~ ✅ Complete
- ~~Create concept generation endpoints~~ ✅ Complete
- Implement relationship mapping logic
- Add caching for generated relationships
- Add authentication if needed

## Resources

- [Laravel Documentation](https://laravel.com/docs/12.x)
- [Laravel AI SDK Documentation](https://laravel.com/docs/12.x/ai-sdk)
- [Laravel Sail Documentation](https://laravel.com/docs/12.x/sail)
- [Laravel Boost Documentation](https://laravel.com/docs/12.x/boost)
- [Expo Documentation](https://docs.expo.dev)
- [Expo Skills (GitHub)](https://github.com/expo/skills) – Cursor users can add Expo Skills as a **Remote Rule** (Settings → Rules & Command → Project Rules → Add Rule → Remote Rule (GitHub) → `https://github.com/expo/skills.git`) for better agent support when working on the client app.
- [Ollama Documentation](https://docs.ollama.com)
- [Edward de Bono - Lateral Thinking](https://www.edwarddebono.com/lateral-thinking)
- [Oblique Strategies - Brian Eno](https://en.wikipedia.org/wiki/Oblique_Strategies)
