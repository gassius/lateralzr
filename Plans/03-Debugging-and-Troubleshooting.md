# 03 - Debugging and Troubleshooting

The public concept graph API is **read-only**. `POST /api/concepts/relationships` loads an existing neighborhood via `ConceptGraphQuery` and does **not** call the LLM. Graph growth is `concepts:prefetch` plus a queue worker (`GenerateConceptGraphJob`). Current request/response shapes are in [README.md](../README.md#concept-graph-neighborhood).

## Ollama Request/Response Logging

When `APP_DEBUG=true`, `AppServiceProvider` registers `LogOllamaRequests` on Laravel AI `PromptingAgent` / `AgentPrompted`. Only the Ollama provider is logged. These events fire on the **prefetch / worker** path (`ConceptRelationshipService` + `ConceptsOnlyAgent`), not on the public read API.

The listener calls `Log::debug('Ollama Request', …)` and `Log::debug('Ollama Response', …)`. Laravel’s log **level** is `DEBUG`; the message string itself has **no** `[DEBUG]` prefix.

### Viewing Logs

```bash
# Sail container logs
./sail logs -f

# Laravel log (storage is bind-mounted)
tail -f storage/logs/laravel.log
```

### What Gets Logged

- **Outgoing requests** (`Ollama Request`): `invocation_id`, `provider`, `model`, `agent_class`, `system_instructions` (the agent’s `instructions()`), `user_message` (the string passed to `->prompt()`), `timeout`.
- **Incoming responses** (`Ollama Response`): `invocation_id`, `provider`, `model`, `response_text`, optional `response_data` (when the result is a `StructuredAgentResponse`), `usage`.

There is no `normalizeResponse()`, no `Raw AI Response` log line, and no title / rationale / strength field extraction on either the read API or the current agent schema.

### Example Log Output

```
[2026-02-13 10:54:27] local.DEBUG: Ollama Request {"invocation_id":"abc123","provider":"OllamaProvider","model":"llama3.2:3b","agent_class":"App\\Ai\\Agents\\ConceptsOnlyAgent","system_instructions":"You are a lateral thinking assistant...","user_message":"Starting concept: \"creativity\"...","timeout":null}
[2026-02-13 10:54:28] local.DEBUG: Ollama Response {"invocation_id":"abc123","provider":"OllamaProvider","model":"llama3.2:3b","response_text":"...","response_data":{"start_concept":"creativity","concepts":[...],"edges":[...]},"usage":null}
```

## Xdebug Configuration

Xdebug is configured in `compose.yaml` but disabled by default. To enable:

### Enable Xdebug

1. **Update `.env`**:
   ```env
   SAIL_XDEBUG_MODE=debug,develop
   SAIL_XDEBUG_CONFIG=client_host=host.docker.internal client_port=9003
   ```

2. **Restart Sail**:
   ```bash
   ./sail down
   ./sail up -d
   ```

3. **Configure your IDE**:
   - **VS Code/Cursor**: Install PHP Debug extension
   - **PhpStorm**: Settings → Languages & Frameworks → PHP → Debug
     - Port: `9003`
     - Xdebug 3.x settings

### Xdebug Settings

- **Mode**: `debug,develop` (for step debugging and development features)
- **Client Host**: `host.docker.internal` (allows IDE on macOS to connect)
- **Client Port**: `9003` (default for Xdebug 3.x)

### Using Xdebug

1. Set breakpoints in your code
2. Start listening for connections in your IDE
3. Make a request to your API
4. Debug step-by-step

### Disable Xdebug

Set in `.env`:
```env
SAIL_XDEBUG_MODE=off
```

Then restart Sail (`./sail down && ./sail up -d`).

## Common Issues

### Prefetch / Ollama not reachable

There is **no** live-Ollama or `smoke` PHPUnit group. `./sail test` runs the default **mocked** suite (no Ollama, Wikipedia, or Wikimedia).

Ollama’s host depends on **where** the command runs:

| Where you run the command | URL | Source |
|---|---|---|
| Host shell (`curl`, `ollama`, `./dev.sh`) | `http://127.0.0.1:11434` | Native Ollama daemon on the host |
| Inside Sail / Laravel (`OLLAMA_BASE_URL`) | `http://host.docker.internal:11434` | Default in `config/ai.php` and `.env.example` so the container reaches the host daemon |

1. **From the host**, confirm Ollama is up:
   ```bash
   curl http://127.0.0.1:11434/api/tags
   ```

2. **Check the model** (default `llama3.2:3b`, same as `.env.example` / `config/ai.php` / `./dev.sh`):
   ```bash
   ollama list
   ollama pull llama3.2:3b
   ```

3. **From Sail**, Laravel uses `OLLAMA_BASE_URL=http://host.docker.internal:11434`. Do not point the container at `127.0.0.1:11434` — that is the container’s own loopback, not the host daemon.

4. **Grow the graph**, then read it (the public POST does not generate):
   ```bash
   ./sail artisan concepts:prefetch --starts=creativity --count=10
   ./sail artisan queue:work --queue=default --timeout=300
   curl -X POST http://localhost/api/concepts/relationships \
     -H "Content-Type: application/json" \
     -d '{"start":"creativity"}'
   ```

5. **Run the mocked suite**:
   ```bash
   ./sail test
   ```

### Graph 404 / empty neighborhood

The read API returns **404** (`No prefetched graph found for this start yet.`) when it cannot resolve a start that already has edges.

- Cold start (omit `start` / `seed`) picks a random concept that **already has relationships**. It does **not** pick `config('concepts.default_seeds')`.
- `default_seeds` is for prefetch / `ConceptSeed` when the terms table is empty (and for the seeder path).
- POST `complexity` only **filters** stored terms; it does not drive generation. Prefetch `--complexity` (default `concepts.default_complexity`) is what the worker writes.

## API examples (curl / Postman)

### Health Check

- **GET** `http://localhost/api/hello`

### Read a prefetched neighborhood

- **POST** `http://localhost/api/concepts/relationships`
- **Headers**: `Content-Type: application/json`
- **Body** (read filters only — this does not generate):
  ```json
  {
    "start": "creativity",
    "locale": "en",
    "complexity": 2
  }
  ```

`start` aliases: `seed`, `localizedConcept`. There is no `{seed, count}` “Generate Concept Relationships” body. `count` is a `concepts:prefetch` CLI option.

### Example Postman collection

```json
{
  "info": {
    "name": "Lateralzr API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "http://localhost/api/hello",
          "protocol": "http",
          "host": ["localhost"],
          "path": ["api", "hello"]
        }
      }
    },
    {
      "name": "Read concept graph neighborhood",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"start\": \"creativity\",\n  \"locale\": \"en\"\n}"
        },
        "url": {
          "raw": "http://localhost/api/concepts/relationships",
          "protocol": "http",
          "host": ["localhost"],
          "path": ["api", "concepts", "relationships"]
        }
      }
    }
  ]
}
```

## Debugging Tips

1. **Ollama logs**: registered only when `APP_DEBUG=true`; look for `Ollama Request` / `Ollama Response` (not `[DEBUG] Ollama Request`).
2. **Confirm the host**: `127.0.0.1:11434` from the host shell; `host.docker.internal:11434` from Sail.
3. **Prefetch before reading**: a 404 means no stored edges for that start, not a live-generate failure.
4. **Test the model on the host**: `ollama run llama3.2:3b`.
5. **Default tests are mocked**: `./sail test` never hits Ollama.

## Useful Commands

```bash
# View real-time logs
./sail logs -f

# Host-shell Ollama checks (not the Sail default)
curl http://127.0.0.1:11434/api/tags
curl -X POST http://127.0.0.1:11434/api/generate -d '{"model":"llama3.2:3b","prompt":"test"}'

# Grow the graph (LLM + queue)
./sail artisan concepts:prefetch --starts=creativity --count=10
./sail artisan queue:work --queue=default --timeout=300

# Clear logs
> storage/logs/laravel.log

# Run the default mocked suite
./sail test
```
