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

### Generate Concept Relationships

**POST** `/api/concepts/relationships`

Generates laterally related concepts from a seed concept using the local LLM.

**Request:**
```json
{
  "seed": "creativity",
  "count": 5
}
```

**Response:**
```json
{
  "data": {
    "seed": "creativity",
    "related_concepts": [
      {
        "concept": "constraint",
        "rationale": "Limitations can spark creative solutions",
        "strength": 0.8
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
├── .cursor/plans/        # Project plans
└── compose.yaml          # Docker Compose configuration
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
sail test

# Smoke tests with real Ollama (requires Ollama running)
AI_SMOKE_TESTS=1 sail test --group=ollama
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
- [Ollama Documentation](https://docs.ollama.com)
- [Edward de Bono - Lateral Thinking](https://www.edwarddebono.com/lateral-thinking)
- [Oblique Strategies - Brian Eno](https://en.wikipedia.org/wiki/Oblique_Strategies)
