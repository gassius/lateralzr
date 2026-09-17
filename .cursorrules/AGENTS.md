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
- JSON responses only (no HTML/Blade views)
- Resource-based routing (`/api/concepts`, `/api/relationships`)
- Consistent error handling and response formatting
- API versioning when needed (future consideration)

### Code Organization
- Follow Laravel conventions strictly
- Use Form Requests for validation
- Use API Resources for response transformation
- Keep controllers thin, move logic to services/actions
- Use Eloquent models with proper relationships
- Implement repository pattern if complexity grows

### Monorepo
- **API** lives at the **repository root** (Laravel, Sail, `app/`, `routes/`, `compose.yaml`). **Expo client** lives in **`apps/client`**. Turborepo orchestrates the root package (admin/Vite) and the client (Expo) so their build and dev tasks do not collide.
- **Node version** is defined in [.nvmrc](.nvmrc); use NVM on the host or the optional Node Docker service (profile `client`) for client tooling.
- **Agents must not assume a single app**: run API commands from the repo root with Sail (`./sail ...`, wrapper for `./vendor/bin/sail`). Run client commands from `apps/client` (e.g. `pnpm exec expo start`, `pnpm exec expo start --web`) or from the root with Turbo: `pnpm turbo run dev --filter=client`. The project uses **pnpm** as the package manager (see [pnpm-workspace.yaml](pnpm-workspace.yaml)).
- **Critical Sail rule (local)**: Do not run `php artisan`, `composer`, `vendor/bin/pint`, or `vendor/bin/phpunit` directly on the host. The `.env` database host (`mysql`) is resolved inside Sail containers. Use `./sail artisan <command>`, `./sail composer <command>`, `./sail test`, and `./sail pint`.
- **Production VPS artisan**: On the Hetzner VPS (`/home/cgonzalez/lateralzr`) do not run `php artisan` on the host either. Use `./bin/artisan <command>` (or `./deploy-prod.sh artisan <command>`). That execs into `lateralzr_app` as `www-data` via `docker-compose.prod.yml`. The app image entrypoint chowns the `./storage` bind-mount and links `public/storage` on every start.
- **Production scheduler**: Host crontab cannot trigger Laravel inside Docker. The `scheduler` service in `docker-compose.prod.yml` runs `php artisan schedule:work --verbose`. Define tasks in `routes/console.php` (not `app/Console/Kernel.php`). `scheduler:test` runs every 15 minutes and logs `Scheduler Test ran at HH:MM:SS on DD/MM/YYYY` to `storage/logs/laravel.log` and `storage/logs/scheduler-test.log`.
- **Concept graph queue workers**: concept generation can spend more than 60 seconds in the LLM plus URL enrichment path. When processing these jobs manually, use `./sail artisan queue:work --queue=default --timeout=300`.

### Expo client
- **Stack**: Expo SDK, React Native, TypeScript, Expo Router. The client fetches concepts from the API and displays them as flip/swipe cards.
- **Expo AI Skills**: When editing or adding code in `apps/client`, agents should use **Expo AI Skills** for accurate Expo/React Native guidance. To enable in Cursor: **Settings → Rules & Command → Project Rules → Add Rule → Remote Rule (GitHub)** → `https://github.com/expo/skills.git`. Skills are auto-discovered for prompts about Expo, UI, data fetching, and deployment (see [expo/skills README](https://github.com/expo/skills/blob/main/README.md)).

## Laravel Conventions to Follow

### Controllers
- Place in `app/Http/Controllers/Api/`
- Use `ApiController` base class if needed
- Keep actions focused and single-purpose
- Return JSON responses using `response()->json()` or API Resources

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

### Concepts Table (Future)
- `id` (primary key)
- `title` (string)
- `description` (text, nullable)
- `category` (string, nullable)
- `generated_at` (timestamp)
- `metadata` (JSON, nullable)
- `timestamps`

### Relationships Table (Future)
- `id` (primary key)
- `source_concept_id` (foreign key)
- `target_concept_id` (foreign key)
- `relationship_type` (string)
- `strength` (decimal, 0-1)
- `metadata` (JSON, nullable)
- `timestamps`

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
6. Commit with descriptive messages

## Code Quality

- Follow PSR-12 coding standards
- Use Laravel Pint for code formatting
- Write self-documenting code with clear variable names
- Add docblocks for complex methods
- Keep methods focused and small

## Common Patterns

### Service Classes
```php
app/Services/ConceptService.php
app/Services/RelationshipService.php
app/Services/LlmService.php
```

### Form Requests
```php
app/Http/Requests/Api/StoreConceptRequest.php
app/Http/Requests/Api/UpdateConceptRequest.php
```

### API Resources
```php
app/Http/Resources/ConceptResource.php
app/Http/Resources/RelationshipResource.php
```

## Notes for AI Agents

- Always check existing code patterns before creating new code
- Use Laravel's built-in features before creating custom solutions
- Follow the existing test structure
- Maintain consistency with established patterns
- Ask for clarification if requirements are ambiguous
- Prioritize testability and maintainability
- **CRITICAL: Always run `./sail test` after making code changes to ensure tests pass and the app is not broken**

## Future Considerations

- Authentication/Authorization (Laravel Sanctum)
- Rate limiting for API endpoints
- Caching strategy for frequently accessed concepts
- Queue jobs for async LLM operations
- API versioning
- Documentation (API documentation generation)

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
