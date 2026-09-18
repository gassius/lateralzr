<?php

namespace App\Ai\Agents;

use App\Ai\Support\AiProviders;
use Laravel\Ai\Attributes\Timeout;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;
use Stringable;

#[Timeout(30)]
class PingAgent implements Agent
{
    use Promptable;

    public function instructions(): Stringable|string
    {
        return 'Reply with exactly the single word pong and nothing else.';
    }

    public function provider(): Lab|array|string|null
    {
        return AiProviders::toLab((string) config('ai.default', 'ollama'));
    }

    public function model(): ?string
    {
        return AiProviders::defaultTextModel((string) config('ai.default', 'ollama'));
    }
}
