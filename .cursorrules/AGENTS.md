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

## Future Considerations

- Authentication/Authorization (Laravel Sanctum)
- Rate limiting for API endpoints
- Caching strategy for frequently accessed concepts
- Queue jobs for async LLM operations
- API versioning
- Documentation (API documentation generation)
