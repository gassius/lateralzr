# Lateralzr API Bootstrap Plan

## Project Overview

Create a greenfield Laravel 12 API server for "Lateralzr" - an app to improve lateral thinking inspired by Oblique Strategies. The API will serve concepts and their relationships, with LLM integration for concept generation.

## Project Structure

- Laravel 12 API-only application (no frontend build toolchain)
- Dockerized development environment using Laravel Sail
- Laravel Boost for AI agent/MCP integration
- Git repository initialization
- Comprehensive documentation (README, AGENTS, Plans directory)

## Implementation Steps

### 1. Bootstrap Laravel 12 Application

- Use Laravel installer: `laravel new lateralzr-api`
- Configure as API-only (no frontend scaffolding needed)
- Laravel Sail will be automatically included

### 2. Configure Laravel Sail

- Sail is pre-installed with new Laravel apps
- Verify `compose.yaml` exists in project root
- Configure shell alias for convenience (optional)
- Set up `.env` file with Docker service configurations

### 3. Install and Configure Laravel Boost

- Install Boost as dev dependency: `composer require laravel/boost --dev`
- Run interactive installer: `php artisan boost:install`
- Select appropriate IDE/agent integrations (Cursor, Claude Code, etc.)
- Generated files (`.mcp.json`, `CLAUDE.md`, `boost.json`) can be gitignored if desired

### 4. Initialize Git Repository

- Initialize git: `git init`
- Create `.gitignore` (Laravel default includes most needed entries)
- Add Boost config files to `.gitignore` if desired (per developer preference)
- Create initial commit with bootstrap code

### 5. Create Documentation Structure

#### README.md

- Project overview and purpose
- Lateral thinking concept explanation
- Setup instructions (Sail, Boost, etc.)
- Development workflow
- API endpoint documentation (starting with hello world)
- Testing instructions

#### AGENTS.md (or .cursorrules/AGENTS.md)

- Project context and goals
- Architecture decisions
- Laravel conventions to follow
- API design patterns
- Testing standards
- LLM integration approach for concept generation
- Database schema patterns (for future concept/relationship models)

#### Plans Directory

- Create `Plans/` directory
- Store this bootstrap plan as `Plans/01-bootstrap.md`
- Document project initialization decisions

### 6. Create Hello World Endpoint

- Create API route in `routes/api.php`: `GET /api/hello`
- Create simple controller or use closure route
- Return JSON response: `{"message": "Hello, Lateralzr API is running!", "status": "ok"}`
- Ensure proper API response formatting

### 7. Create Smoke Test

- Create feature test: `tests/Feature/ApiHealthTest.php`
- Test the `/api/hello` endpoint
- Verify JSON response structure
- Verify status code (200)
- Run tests via Sail: `sail test`

### 8. Verify Setup

- Start Sail: `sail up -d`
- Test endpoint via curl: `curl http://localhost/api/hello`
- Run smoke test: `sail test`
- Verify Boost MCP configuration is working

## Files to Create/Modify

### New Files

- `README.md` - Main project documentation
- `AGENTS.md` or `.cursorrules/AGENTS.md` - Agent context file
- `Plans/01-bootstrap.md` - This bootstrap plan
- `routes/api.php` - API routes (may exist, needs hello route)
- `tests/Feature/ApiHealthTest.php` - Smoke test

### Modified Files

- `.env` - Docker/Sail configuration
- `.gitignore` - Add Boost config files if desired
- `composer.json` - After Boost installation

### Generated Files (by Boost)

- `.mcp.json` - MCP server configuration
- `CLAUDE.md` - Claude AI guidelines
- `boost.json` - Boost configuration
- `compose.yaml` - Docker Compose configuration (Sail)

## Key Commands Reference

```bash
# Bootstrap Laravel
laravel new lateralzr-api

# Install Boost
composer require laravel/boost --dev
php artisan boost:install

# Sail commands
./vendor/bin/sail up -d
./vendor/bin/sail test
./vendor/bin/sail artisan route:list

# Git
git init
git add .
git commit -m "Initial commit: Bootstrap Lateralzr API"

# Testing
sail test
curl http://localhost/api/hello
```

## Next Steps (Post-Bootstrap)

- Design database schema for concepts and relationships
- Set up Laravel AI SDK for LLM integration
- Create concept generation endpoints
- Implement relationship mapping logic
- Add authentication if needed
- Set up CI/CD pipeline

## Notes

- No frontend build toolchain needed (API-only)
- Focus on API endpoints and test coverage
- Use Laravel conventions throughout
- Leverage Boost for AI-assisted development
- All development happens in Docker via Sail
