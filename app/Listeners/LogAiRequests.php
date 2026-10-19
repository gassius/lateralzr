<?php

namespace App\Listeners;

use App\Ai\Support\AiRequestContext;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Events\AgentPrompted;
use Laravel\Ai\Events\PromptingAgent;
use Laravel\Ai\Responses\Data\Usage;
use Throwable;

class LogAiRequests
{
    /**
     * @var array<string, bool>
     */
    private static array $loggedInvocations = [];

    public function handle(PromptingAgent|AgentPrompted $event): void
    {
        try {
            $prompt = $event->prompt;
            $providerInstance = $prompt->provider();
            $provider = method_exists($providerInstance, 'name')
                ? (string) $providerInstance->name()
                : class_basename($providerInstance);
            $model = is_string($prompt->model) && $prompt->model !== ''
                ? $prompt->model
                : 'default';

            $invocationId = $event->invocationId;
            $logKey = ($event instanceof PromptingAgent ? 'request' : 'response').':'.$invocationId;

            if (isset(self::$loggedInvocations[$logKey])) {
                return;
            }

            self::$loggedInvocations[$logKey] = true;

            if (count(self::$loggedInvocations) > 100) {
                self::$loggedInvocations = array_slice(self::$loggedInvocations, -50, null, true);
            }

            $context = [
                'invocation_id' => $invocationId,
                'provider' => $provider,
                'model' => $model,
                'run_uuid' => AiRequestContext::runUuid(),
                'job_key' => AiRequestContext::jobKey(),
            ];

            if ($event instanceof PromptingAgent) {
                AiRequestContext::rememberSent($provider, $model);
                $context['agent_class'] = $prompt->agent::class;
                $context['timeout'] = $prompt->timeout ?? null;
                Log::info('AI request', $context);

                return;
            }

            $usage = $this->usagePayload($event->response->usage ?? null);
            AiRequestContext::rememberSent($provider, $model, $usage);
            $context['usage'] = $usage;
            Log::info('AI response', $context);
        } catch (Throwable $e) {
            Log::warning('Failed to log AI request/response', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * @return array{prompt:?int,completion:?int,total:?int}|null
     */
    protected function usagePayload(mixed $usage): ?array
    {
        if ($usage instanceof Usage) {
            $prompt = $usage->promptTokens;
            $completion = $usage->completionTokens;

            return [
                'prompt' => $prompt,
                'completion' => $completion,
                'total' => $prompt + $completion,
            ];
        }

        if (is_object($usage)) {
            $prompt = $usage->promptTokens ?? $usage->prompt_tokens ?? null;
            $completion = $usage->completionTokens ?? $usage->completion_tokens ?? null;
            $total = $usage->totalTokens ?? $usage->total_tokens ?? null;

            if ($prompt === null && $completion === null && $total === null) {
                return null;
            }

            $prompt = is_numeric($prompt) ? (int) $prompt : null;
            $completion = is_numeric($completion) ? (int) $completion : null;
            $total = is_numeric($total)
                ? (int) $total
                : (($prompt !== null && $completion !== null) ? $prompt + $completion : null);

            return [
                'prompt' => $prompt,
                'completion' => $completion,
                'total' => $total,
            ];
        }

        return null;
    }
}
