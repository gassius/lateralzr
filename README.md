# Lateralzr API

A Laravel 12 API server for **Lateralzr** - an application designed to improve lateral thinking skills, inspired by Edward de Bono's lateral thinking concepts and Brian Eno's Oblique Strategies card set.

## Project Overview

Lateralzr aims to help users develop lateral thinking abilities by presenting concepts and allowing users to explore lateralized (non-linear) relationships between ideas. The API serves as the backend that provides concepts and their relationships, with LLM integration for generating new concepts and connections.

### What is Lateral Thinking?

Lateral thinking, as defined by Edward de Bono, is a method of problem-solving that uses indirect and creative approaches. Unlike vertical (logical) thinking, lateral thinking involves looking at problems from new angles and finding unexpected solutions.

## Tech Stack

- **Framework**: Laravel 12
- **Development Environment**: Laravel Sail (Docker)
- **AI Integration**: Laravel Boost (MCP/Agent integration)
- **Database**: MySQL (via Sail)
- **Testing**: PHPUnit

## Prerequisites

- Docker Desktop installed and running
- Git
- Composer (optional - Sail includes it)

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
./vendor/bin/sail up -d
```

Or if you've configured the shell alias:

```bash
sail up -d
```

### 4. Generate Application Key

```bash
sail artisan key:generate
```

### 5. Run Migrations

```bash
sail artisan migrate
```

## Development Workflow

### Running the Application

The API will be available at `http://localhost` (or the port configured in your `.env`).

### Common Sail Commands

```bash
# Start containers
sail up -d

# Stop containers
sail stop

# View logs
sail logs

# Run Artisan commands
sail artisan <command>

# Run Composer commands
sail composer <command>

# Run tests
sail test

# Access container shell
sail shell

# Access Tinker
sail tinker
```

### Running Tests

```bash
# Run all tests
sail test

# Run specific test file
sail test tests/Feature/ApiHealthTest.php

# Run with coverage
sail test --coverage
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

## Project Structure

```
lateralzr-api/
├── app/                    # Application code
│   ├── Http/
│   │   └── Controllers/   # API controllers
│   └── Models/            # Eloquent models
├── database/
│   ├── migrations/        # Database migrations
│   └── seeders/          # Database seeders
├── routes/
│   └── api.php           # API routes
├── tests/                 # Test suite
│   └── Feature/          # Feature tests
├── Plans/                # Project plans and documentation
└── compose.yaml          # Docker Compose configuration
```

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
4. Ensure all tests pass: `sail test`
5. Submit a pull request

## Testing

This project emphasizes test-driven development. All new features should include:

- Unit tests for business logic
- Feature tests for API endpoints
- Integration tests for complex workflows

Run the test suite:

```bash
sail test
```

## License

[To be determined]

## Next Steps

- Design database schema for concepts and relationships
- Set up Laravel AI SDK for LLM integration
- Create concept generation endpoints
- Implement relationship mapping logic
- Add authentication if needed

## Resources

- [Laravel Documentation](https://laravel.com/docs/12.x)
- [Laravel Sail Documentation](https://laravel.com/docs/12.x/sail)
- [Laravel Boost Documentation](https://laravel.com/docs/12.x/boost)
- [Edward de Bono - Lateral Thinking](https://www.edwarddebono.com/lateral-thinking)
- [Oblique Strategies - Brian Eno](https://en.wikipedia.org/wiki/Oblique_Strategies)
