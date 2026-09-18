<?php

namespace App\Console\Commands;

use App\Ai\Agents\PingAgent;
use App\Ai\Support\AiProviders;
use App\Ai\Support\AiRequestError;
use Illuminate\Console\Command;
use InvalidArgumentException;
use Throwable;

class PingAiProvider extends Command
{
    protected $signature = 'ai:ping
        {--provider= : AI provider (ollama|openrouter|openai|anthropic|gemini) (default from config)}
        {--model= : AI model (default from provider config)}
        {--dry-run : Print resolved provider and model without calling the API}';

    protected $description = 'Verify the configured AI provider and model (OpenRouter/Ollama/etc.) with a tiny prompt.';

    public function handle(): int
    {
        try {
            $provider = AiProviders::normalize($this->option('provider') ? (string) $this->option('provider') : null);
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $model = $this->option('model') ? (string) $this->option('model') : AiProviders::defaultTextModel($provider);
        $key = config("ai.providers.{$provider}.key");
        $keyConfigured = is_string($key) && trim($key) !== '';

        $this->info("provider={$provider}");
        $this->info("model={$model}");
        $this->info('key_configured='.($keyConfigured ? 'yes' : 'no'));

        if ($provider === 'openrouter' && str_contains($model, 'deepseek/deepseek-v4-flash')) {
            $this->warn('Model id looks invalid for OpenRouter (historical 404). Use a listed id such as openai/gpt-4o-mini.');
        }

        if ($this->option('dry-run')) {
            return self::SUCCESS;
        }

        if ($provider !== 'ollama' && ! $keyConfigured) {
            $this->error("No API key configured for [{$provider}]. Set the provider key in .env (e.g. OPENROUTER_API_KEY).");

            return self::FAILURE;
        }

        $previousProvider = config('ai.default');
        $previousModel = config('ai.models.text');
        config()->set('ai.default', $provider);
        config()->set('ai.models.text', $model);

        try {
            $response = (new PingAgent)->prompt(
                'Reply with exactly the word pong.',
                provider: $provider,
                model: $model,
            );
            $text = '';
            if (is_object($response) && isset($response->text)) {
                $text = trim((string) $response->text);
            } elseif (is_object($response) && method_exists($response, '__toString')) {
                $text = trim((string) $response);
            }
            $this->info($text !== '' ? $text : '(empty response)');

            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->error(AiRequestError::displayMessage($e, $provider, $model));

            return self::FAILURE;
        } finally {
            config()->set('ai.default', $previousProvider);
            config()->set('ai.models.text', $previousModel);
        }
    }
}
