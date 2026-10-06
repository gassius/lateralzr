# Lateralzr API - Agent Context

This document provides context and guidelines for AI agents working on the Lateralzr API project.

## Project Overview

**Lateralzr** is an API server designed to support an application that improves lateral thinking skills. The project is inspired by:
- **Edward de Bono's Lateral Thinking**: A method of problem-solving using indirect and creative approaches
- **Brian Eno's Oblique Strategies**: A card set designed to break creative blocks by encouraging lateral thinking

## Project Goals

1. Serve concepts and their lateralized relationships via REST API
2. Use LLM integration (Laravel AI SDK) to generate concepts and relationships
3. Provide a robust, testable API backend for a mobile/web frontend application
4. Maintain high code quality through testing and Laravel best practices

## Architecture Decisions

### Framework & Tools
- **Laravel 12**: Modern PHP framework with excellent API capabilities
- **Laravel Sail**: Dockerized development environment for consistency
- **Laravel Boost**: MCP integration for AI-assisted development
- **MySQL**: Primary database (via Sail)
- **PHPUnit**: Testing framework
- **Admin backoffice**: Filament 5 panel at `/admin`; access restricted to users with the `super_admin` role (Spatie Laravel Permission). Roles/permissions are extensible; the first role is `super_admin` with full capabilities. Filament resources provide quick CRUD for models (e.g. Concept, User). The Concept model (table `concepts`) is the main entity for concept/URL data; User model holds app users and roles. Production Filament is served at `https://api.lateralzr.com/admin`. Web 500s must appear in `storage/logs/laravel.log` **and** `docker compose logs app` (PHP `log_errors=On`, FPM `catch_workers_output`, Laravel stack includes `stderr`).

### API Design Principles
- RESTful API design
- Public API responses are JSON (`routes/api.php`). Filament admin at `/admin` is Livewire/Blade HTML — not a Vite SPA.
- Resource-based routing (`/api/concepts/relationships`, `/api/media`, `/api/hello`)
- Consistent error handling and response formatting
- API versioning when needed (future consideration)

### Code Organization
- Follow Laravel conventions strictly
- Keep controllers thin, move logic to services/actions
- Validate at the controller/`Request` layer (no unused Form Request / API Resource skeleton)
- Use Eloquent models with proper relationships
- Implement repository pattern if complexity grows

### Monorepo
- **API** lives at the **repository root** (Laravel, Sail, Filament `/admin`, `app/`, `routes/`, `compose.yaml`). **Expo client** lives in **`apps/client`**. There is **no root Vite / Laravel frontend asset pipeline**. Root `package.json` is the pnpm workspace root (`turbo`); Turborepo runs **Expo client** `build` / `dev` only (`pnpm turbo run dev --filter=client`). Filament Concept Graph Explorer uses `window.cytoscape` from the unpkg script in `AdminPanelProvider`, not an npm cytoscape bundle.
- **Node version** is defined in [.nvmrc](.nvmrc); use NVM on the host or the optional Node Docker service (profile `client`) for client tooling.
- **Agents must not assume a single app**: run API commands from the repo root with Sail (`./sail ...`, wrapper for `./vendor/bin/sail`). Run client commands from `apps/client` (e.g. `pnpm exec expo start`, `pnpm exec expo start --web`) or from the root with Turbo: `pnpm turbo run dev --filter=client`. The project uses **pnpm** as the package manager (see [pnpm-workspace.yaml](pnpm-workspace.yaml)).
- **Critical Sail rule (local)**: Do not run `php artisan`, `composer`, `vendor/bin/pint`, or `vendor/bin/phpunit` directly on the host. The `.env` database host (`mysql`) is resolved inside Sail containers. Use `./sail artisan <command>`, `./sail composer <command>`, `./sail test`, and `./sail pint`.
- **Production VPS artisan**: On the Hetzner VPS (`/home/cgonzalez/lateralzr`) do not run `php artisan` on the host either. Use `./bin/artisan <command>` (or `./deploy-prod.sh artisan <command>`). That execs into `lateralzr_app` as `www-data` via `docker-compose.prod.yml`. The app image entrypoint chowns the `./storage` bind-mount and links `public/storage` on every start. Create Filament admins with `users:create-filament-admin` / `users:promote-filament-admin` — not `make:filament-user` alone (`canAccessPanel` requires `super_admin`).
- **Production scheduler**: Host crontab cannot trigger Laravel inside Docker. The `scheduler` service in `docker-compose.prod.yml` runs `php artisan schedule:work --verbose`. Define tasks in `routes/console.php`. `scheduler:test` runs every 15 minutes and logs `Scheduler Test ran at HH:MM:SS on DD/MM/YYYY` to `storage/logs/laravel.log` and `storage/logs/scheduler-test.log`.
- **Concept graph queue workers**: concept generation can spend more than 60 seconds in the LLM plus URL enrichment path. When processing these jobs manually, use `./sail artisan queue:work --queue=default --timeout=300`.

### Expo client
- **Stack**: Expo SDK 54, React Native, TypeScript, Expo Router. Lives in **`apps/client`**. The client fetches concepts from the API and displays them as flip/swipe cards (web export today; native builds when needed).
- **Agent context**: Cursor/Codex read [`apps/client/AGENTS.md`](../apps/client/AGENTS.md). Claude Code imports it via `apps/client/CLAUDE.md` and `.claude/settings.json` (Expo plugin enabled).
- **Expo Skills**: Install once per machine with `pnpm dlx skills add expo/skills` (or Cursor Remote Rule → `https://github.com/expo/skills.git`). Skills auto-apply on Expo-related prompts — see https://docs.expo.dev/skills.md.
- **Expo MCP**: Registered in [`.cursor/mcp.json`](../.cursor/mcp.json) as remote server `https://mcp.expo.dev/mcp` (OAuth in Cursor Settings → Tools & MCP). Local capabilities (screenshots, tap automation, DevTools) need `expo-mcp` and `pnpm start:mcp` from `apps/client` (`EXPO_UNSTABLE_MCP_SERVER=1`). Docs: https://docs.expo.dev/mcp.md · https://docs.expo.dev/agents/cursor.md.
- When working under `apps/client`, prefer Expo Skills + Expo MCP over inventing APIs or package versions from training data.

## Laravel Conventions to Follow

### Controllers
- Place in `app/Http/Controllers/Api/`
- Keep actions focused and single-purpose
- Return JSON with `response()->json()` (no API Resource classes today)

### Models
- Use Eloquent models in `app/Models/`
- Define relationships clearly
- Use factories for testing
- Implement proper casts and accessors/mutators

### Routes
- API routes in `routes/api.php`
- Use `Route::apiResource()` for RESTful resources
- Group related routes with middleware
- Use route model binding

### Testing
- Feature tests for API endpoints in `tests/Feature/`
- Unit tests for business logic in `tests/Unit/`
- Use factories for test data
- Test both success and failure scenarios
- Aim for high test coverage

### Database
- Use migrations for all schema changes
- Name migrations descriptively: `YYYY_MM_DD_HHMMSS_create_concepts_table.php`
- Use seeders for initial data
- Follow Laravel naming conventions (plural table names, snake_case)

## API Design Patterns

### Response Format
```json
{
  "data": { ... },
  "message": "Optional message",
  "status": "success|error"
}
```

### Error Handling
- Use Laravel's exception handling
- Return appropriate HTTP status codes
- Provide clear error messages
- Log errors appropriately

### Validation
- Use Form Request classes for complex validation
- Return validation errors in consistent format
- Validate at the request level, not in controllers

## LLM Integration Approach

### Concept Generation
- Use Laravel AI SDK for LLM interactions
- Create dedicated services for LLM operations
- Cache generated concepts when appropriate
- Handle rate limiting and API errors gracefully

### Relationship Mapping
- Generate lateral relationships between concepts
- Store relationships in database for performance
- Allow regeneration/refresh of relationships
- Consider relationship strength/confidence scores

## Database Schema Patterns

Do **not** invent a parallel concepts schema. Current tables/models already exist:

- `concepts` — language-neutral `canonical_key` (`app/Models/Concept.php`)
- `concept_terms` — per-locale label, description, wiki/media URLs, complexity
- `concept_relationships` — from/to, strength, last_laterality (the API edge JSON exposes laterality)
- `concept_media` — ordered media rows on a concept

See `database/migrations/` and the models under `app/Models/`.

## Testing Standards

### Feature Tests
- Test all API endpoints
- Test authentication/authorization (when added)
- Test validation rules
- Test error scenarios
- Use descriptive test names: `test_user_can_retrieve_concept_by_id`

### Unit Tests
- Test business logic in isolation
- Test model relationships
- Test service classes
- Mock external dependencies (LLM APIs)

### Test Data
- Use factories for model creation
- Use seeders for consistent test data
- Clean up test data appropriately
- Use database transactions when possible

## Development Workflow

1. Create feature branch
2. Write tests first (TDD approach)
3. Implement feature
4. Ensure all tests pass
5. Run code quality checks (Pint)
6. Commit with descriptive messages (AI agents must also add [git trailers](#agent-attribution))

## Agent attribution

Every commit, pull request, and review comment made by an AI agent must identify the agent, the ClickUp ticket (or `none` / a GitHub issue-or-PR reference), and (when known) the Cursor agent run. A short always-applied reminder lives in [`.cursor/rules/agent-attribution.mdc`](../.cursor/rules/agent-attribution.mdc).

### Commits

AI-agent commits must end with **one contiguous trailer block**: the final paragraph of the message, with no blank lines inside it. Git only treats that last paragraph as trailers. The block contains `Agent:`, `Agent-Ticket:`, `Agent-Run:` (when known), and any other trailers such as `Co-authored-by:`. There must be no blank line between the `Agent:` lines and `Co-authored-by:`.

Add them with `--trailer` so they form that final paragraph (do not type a separate paragraph by hand):

```bash
git commit --trailer 'Agent: …' --trailer 'Agent-Ticket: …' --trailer 'Agent-Run: …'
```

Example with a subject and body:

```bash
git commit -m "subject" -m "body" \
  --trailer 'Agent: GasNet Implementer' \
  --trailer 'Agent-Ticket: 869f9e0zr' \
  --trailer 'Agent-Run: https://cursor.com/agents/<bc id>'
```

`Agent:` is exactly one name from [Known identities](#known-identities).

`Agent-Ticket:` is the ClickUp task id. When there is no ClickUp task, use `Agent-Ticket: none`, or the GitHub issue/PR reference if there is one (for example `Agent-Ticket: #64`).

`Agent-Run:` is always the full `https://cursor.com/agents/<bc id>` URL. Omit the line when the run URL is unknown.

If tooling would append `Co-authored-by:` after a blank line, include that trailer yourself so it joins the same block (`--trailer 'Co-authored-by: …'` or `git interpret-trailers --in-place --trailer …`). Cursor's commit-msg hook skips adding `Co-authored-by:` when the message already has one.

Before pushing, check:

```bash
git log -1 --format='%(trailers:key=Agent,valueonly)'
```

It must print the agent name. `git interpret-trailers --parse` on the commit message must list every `Agent*` trailer (and `Co-authored-by:` if present) in one block.

**Carve-out:** merge commits created by GitHub's update-branch button or API have no trailers. That is acceptable. Attribute those updates in a PR comment instead.

### Pull requests

The same three lines appear as a footer. That footer is the last human-written section of the PR description; tool-appended HTML (Open in Web / Open in Cursor badges, `<!-- CURSOR_AGENT_PR_BODY_* -->` wrappers) may follow.

In the PR body, the footer may use the bare bc id for `Agent-Run:` if the form rejects the `https://cursor.com/agents/…` URL. Commits still use the full URL.

### PR comments and reviews

Every agent comment starts with `### Agent: <name>` as the first line.

`**Verdict:**` is required on reviews and on verdict or status comments only (for example `**Verdict:** Approve | Request changes | Comment`). Plain replies need only the `### Agent:` header.

### Known identities

- **GasNet Implementer**: Cursor cloud agents launched by Engineer Supervisor. Commits are authored by Cursor's `cursoragent` account (`Cursor Agent <cursoragent@cursor.com>`) and identified by `Agent: GasNet Implementer` trailers.
- **Nightly Audit Engineer**: also uses Cursor cloud agents; identified by `Agent: Nightly Audit Engineer`.
- **Engineer Supervisor**: writes as GitHub App `gasnet-supervisor-gassius[bot]` (since 2026-09-30).
- **Pull Request Reviewer**: writes as GitHub App `gasnet-reviewer-gassius[bot]` (since 2026-09-30).

Before 2026-09-30, Engineer Supervisor and Pull Request Reviewer actions appear as `gassius`. The `### Agent:` header is then the only attribution.

Only Carlos (`gassius`) merges PRs. Agents never merge, enable auto-merge, or mark PRs Ready unless Carlos asks.

## Code Quality

- Follow PSR-12 coding standards
- Use Laravel Pint for code formatting
- Write self-documenting code with clear variable names
- Add docblocks for complex methods
- Keep methods focused and small

## Common Patterns

### Existing service / HTTP surfaces
```php
app/Services/ConceptGraphQuery.php
app/Services/ConceptRelationshipService.php
app/Services/ConceptGraphPrefetchService.php
app/Http/Controllers/Api/ConceptRelationshipController.php
app/Http/Controllers/Api/RemoteMediaController.php
```

Public API controllers validate with `Request` today. There are no `app/Http/Requests/Api/*` or `app/Http/Resources/*` classes — do not recreate those Laravel-skeleton names unless a task needs them.

## Notes for AI Agents

- Always check existing code patterns before creating new code
- Use Laravel's built-in features before creating custom solutions
- Follow the existing test structure
- Maintain consistency with established patterns
- Ask for clarification if requirements are ambiguous
- Prioritize testability and maintainability
- **CRITICAL: Always run `./sail test` after making code changes to ensure tests pass and the app is not broken**

## Future Considerations

- Authentication/Authorization (Laravel Sanctum) for the public API
- Broader rate limiting beyond `/api/media`
- API versioning
- Generated public API documentation

Queue workers for graph generation, localisation, and wiki/media enrichment already exist (`GenerateConceptGraphJob`, `LocalizeConceptBatchJob`, `CompleteConceptInfoBatchJob`). Do not add a second job stack.

## Laravel Boost & MCP Usage

- Laravel Boost is installed and available in this project (`laravel/boost` v2.1.3 with `laravel/mcp` v0.5.6).
- Agents **should use Boost MCP tools** to understand and work with the app instead of generic shell commands whenever possible.
- Prefer these tools for:
  - **Application info**: `project-0-lateralzr-api-laravel-boost-application-info`
  - **Database**: `project-0-lateralzr-api-laravel-boost-database-schema`, `project-0-lateralzr-api-laravel-boost-database-query`, `project-0-lateralzr-api-laravel-boost-database-connections`
  - **Routes**: `project-0-lateralzr-api-laravel-boost-list-routes`
  - **Config & env**: `project-0-lateralzr-api-laravel-boost-get-config`, `project-0-lateralzr-api-laravel-boost-list-available-env-vars`
  - **Logs & errors**: `project-0-lateralzr-api-laravel-boost-read-log-entries`, `project-0-lateralzr-api-laravel-boost-last-error`, `project-0-lateralzr-api-laravel-boost-browser-logs`
  - **URLs**: `project-0-lateralzr-api-laravel-boost-get-absolute-url`
  - **Artisan & Tinker**: `project-0-lateralzr-api-laravel-boost-list-artisan-commands`, `project-0-lateralzr-api-laravel-boost-tinker`
- When exploring or debugging, agents should **reach for Boost tools first**, then fall back to generic filesystem or shell tools only when necessary.
