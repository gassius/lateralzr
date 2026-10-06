<?php

namespace Tests\Feature;

use App\Services\ConceptLocalizeService;
use Tests\TestCase;

class LocalizeConceptTermsCommandTest extends TestCase
{
    public function test_command_rejects_identical_locales(): void
    {
        $this->artisan('concepts:localize', ['--from' => 'en', '--to' => 'en'])
            ->expectsOutputToContain('must differ')
            ->assertFailed();
    }

    public function test_command_rejects_unsupported_locale(): void
    {
        $this->artisan('concepts:localize', ['--from' => 'en', '--to' => 'fr'])
            ->expectsOutputToContain('supported list')
            ->assertFailed();
    }

    public function test_sync_run_restores_ai_config_after_provider_override(): void
    {
        config([
            'ai.default' => 'openai',
            'ai.models.text' => 'gpt-4o-mini',
        ]);

        $this->mock(ConceptLocalizeService::class, function ($mock) {
            $mock->shouldReceive('localize')
                ->once()
                ->andReturnUsing(function () {
                    $this->assertSame('ollama', config('ai.default'));
                    $this->assertSame('llama3.2:3b', config('ai.models.text'));

                    return [
                        'processed' => 0,
                        'created' => 0,
                        'skipped' => 0,
                        'failed' => 0,
                        'deferred' => 0,
                        'deferredConceptIds' => [],
                    ];
                });
        });

        $this->artisan('concepts:localize', [
            '--from' => 'en',
            '--to' => 'es',
            '--sync' => true,
            '--provider' => 'ollama',
            '--model' => 'llama3.2:3b',
        ])->assertSuccessful();

        $this->assertSame('openai', config('ai.default'));
        $this->assertSame('gpt-4o-mini', config('ai.models.text'));
    }
}
