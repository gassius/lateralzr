<?php

namespace App\Listeners;

use Illuminate\Support\Facades\Log;
use Laravel\Ai\Events\AgentPrompted;
use Laravel\Ai\Events\PromptingAgent;
use Laravel\Ai\Responses\AgentResponse;
use Laravel\Ai\Responses\StructuredAgentResponse;
use Laravel\Ai\Responses\StreamedAgentResponse;

class LogOllamaRequests
{
    /**
     * Track logged invocation IDs to prevent duplicates.
     *
     * @var array<string, bool>
     */
    private static array $loggedInvocations = [];

    /**
     * Handle the event.
     */
    public function handle(PromptingAgent|AgentPrompted $event): void
    {
        try {
            $prompt = $event->prompt;
            
            // Extract provider and model from prompt
            $providerInstance = $prompt->provider();
            $providerName = class_basename($providerInstance);
            $model = $prompt->model ?? 'default';

            // Only log for Ollama provider (check class name)
            if (!str_contains(strtolower($providerName), 'ollama')) {
                return;
            }

            // Use invocation ID to prevent duplicate logs
            $invocationId = $event->invocationId;
            $logKey = ($event instanceof PromptingAgent ? 'request' : 'response').':'.$invocationId;

            // Skip if we've already logged this invocation
            if (isset(self::$loggedInvocations[$logKey])) {
                return;
            }

            // Mark as logged
            self::$loggedInvocations[$logKey] = true;

            // Keep only last 100 logged invocations to prevent memory leak
            if (count(self::$loggedInvocations) > 100) {
                self::$loggedInvocations = array_slice(self::$loggedInvocations, -50, null, true);
            }

            if ($event instanceof PromptingAgent) {
                // Log outgoing request
                Log::channel('single')->debug('Ollama Request', [
                    'invocation_id' => $invocationId,
                    'provider' => $providerName,
                    'model' => $model,
                    'prompt_text' => $prompt->prompt,
                    'timeout' => $prompt->timeout ?? null,
                ]);
            } elseif ($event instanceof AgentPrompted) {
                // Log incoming response
                /** @var AgentResponse|StreamedAgentResponse $response */
                $response = $event->response;
                $responseData = [
                    'invocation_id' => $invocationId,
                    'provider' => $providerName,
                    'model' => $model,
                ];

                // Get response text (AgentResponse extends TextResponse which has a text property)
                $responseData['response_text'] = $response->text ?? 'N/A';

                // Try to get structured data (if StructuredAgentResponse)
                if ($response instanceof StructuredAgentResponse) {
                    $responseData['response_data'] = $response->toArray();
                }

                // Get usage info (AgentResponse has usage property)
                $responseData['usage'] = $response->usage ?? null;

                Log::channel('single')->debug('Ollama Response', $responseData);
            }
        } catch (\Throwable $e) {
            // Silently fail logging to avoid breaking the application
            // Log the error itself for debugging
            Log::channel('single')->warning('Failed to log Ollama request/response', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
