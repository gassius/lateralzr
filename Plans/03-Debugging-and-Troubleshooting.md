# 03 - Debugging and Troubleshooting

## Ollama Request/Response Logging

Raw Ollama requests and responses are automatically logged when `APP_DEBUG=true` in your `.env` file.

### Viewing Logs

```bash
# View logs in real-time
sail logs -f

# Or view the log file directly
tail -f storage/logs/laravel.log
```

### What Gets Logged

- **Outgoing Requests**: Prompt text, model, provider, invocation ID
- **Incoming Responses**: Response text, structured data, usage information

Look for log entries prefixed with:
- `[DEBUG] Ollama Request`
- `[DEBUG] Ollama Response`

### Example Log Output

```
[2026-02-13 10:54:27] local.DEBUG: Ollama Request {"invocation_id":"abc123","provider":"OllamaProvider","model":"llama3.2:3b","prompt_text":"Given the seed concept: \"creativity\"..."}
[2026-02-13 10:54:28] local.DEBUG: Ollama Response {"invocation_id":"abc123","provider":"OllamaProvider","model":"llama3.2:3b","response_text":"...","response_data":{"seed":"creativity","related_concepts":[...]}}
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
   sail down
   sail up -d
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

Then restart Sail.

## Common Issues

### Empty Concept Strings

If you're seeing empty strings in the `concept` field:

1. **Check the logs** for the raw response structure
2. The LLM might be returning data in a different format than expected
3. The normalization logic tries multiple field names (`concept`, `name`, `title`)
4. If concept is empty but rationale exists, it attempts to extract concept from rationale

**Debug steps**:
```bash
# Check logs for raw response
sail logs | grep "Raw AI Response Data"

# Or check log file
tail -n 100 storage/logs/laravel.log | grep -A 20 "Raw AI Response"
```

### Smoke Tests Failing

If smoke tests fail:

1. **Ensure Ollama is running**:
   ```bash
   curl http://127.0.0.1:11434/api/tags
   ```

2. **Check model is available**:
   ```bash
   ollama list
   ```

3. **Pull the model if missing**:
   ```bash
   ollama pull llama3.2:3b
   ```

4. **Run tests with verbose output**:
   ```bash
   AI_SMOKE_TESTS=1 sail test --group=ollama -v
   ```

5. **Check test logs** for specific error messages

### Response Structure Issues

The LLM might return data in unexpected formats. The service handles:
- `concept`, `name`, or `title` fields
- `rationale`, `explanation`, or `reason` fields  
- `strength` or `score` fields

If issues persist, check the raw response in logs and adjust the normalization logic in `ConceptRelationshipService::normalizeResponse()`.

## Postman Collection

A Postman collection can be created for testing. Basic endpoints:

### Health Check
- **GET** `http://localhost/api/hello`

### Generate Concept Relationships
- **POST** `http://localhost/api/concepts/relationships`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "seed": "creativity",
    "count": 5
  }
  ```

### Creating Postman Collection

1. Import the following as a Postman collection:

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
      "name": "Generate Concept Relationships",
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
          "raw": "{\n  \"seed\": \"creativity\",\n  \"count\": 5\n}"
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

2. Save as `Lateralzr-API.postman_collection.json` in your project root

## Debugging Tips

1. **Enable detailed logging**: Already enabled when `APP_DEBUG=true`
2. **Check response structure**: Look for "Raw AI Response Data" in logs
3. **Test with simple prompts**: Start with basic concepts
4. **Verify Ollama connectivity**: Use `curl` to test Ollama directly
5. **Check model output**: Test model directly with `ollama run llama3.2:3b`

## Useful Commands

```bash
# View real-time logs
sail logs -f

# Test Ollama directly
curl http://127.0.0.1:11434/api/tags
curl -X POST http://127.0.0.1:11434/api/generate -d '{"model":"llama3.2:3b","prompt":"test"}'

# Clear logs
> storage/logs/laravel.log

# Run tests with debug output
AI_SMOKE_TESTS=1 sail test --group=ollama --debug
```
