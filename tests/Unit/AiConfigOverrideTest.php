<?php

namespace Tests\Unit;

use App\Ai\Support\AiConfigOverride;
use RuntimeException;
use Tests\TestCase;

class AiConfigOverrideTest extends TestCase
{
    public function test_run_restores_ai_config_after_callback_throws(): void
    {
        config([
            'ai.default' => 'openai',
            'ai.models.text' => 'gpt-4o-mini',
        ]);

        try {
            AiConfigOverride::run('ollama', 'llama3.2:3b', function (): never {
                $this->assertSame('ollama', config('ai.default'));
                $this->assertSame('llama3.2:3b', config('ai.models.text'));

                throw new RuntimeException('forced override failure');
            });
            $this->fail('Expected RuntimeException');
        } catch (RuntimeException $e) {
            $this->assertSame('forced override failure', $e->getMessage());
        }

        $this->assertSame('openai', config('ai.default'));
        $this->assertSame('gpt-4o-mini', config('ai.models.text'));
    }

    public function test_null_provider_and_model_do_not_override(): void
    {
        config([
            'ai.default' => 'openai',
            'ai.models.text' => 'gpt-4o-mini',
        ]);

        $result = AiConfigOverride::run(null, null, function (): string {
            $this->assertSame('openai', config('ai.default'));
            $this->assertSame('gpt-4o-mini', config('ai.models.text'));

            return 'ok';
        });

        $this->assertSame('ok', $result);
        $this->assertSame('openai', config('ai.default'));
        $this->assertSame('gpt-4o-mini', config('ai.models.text'));
    }
}
