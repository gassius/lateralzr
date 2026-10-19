<?php

namespace Tests\Unit;

use App\Ai\Support\AiPrompt;
use Tests\TestCase;

class AiPromptTest extends TestCase
{
    public function test_source_does_not_special_case_mockery(): void
    {
        $source = file_get_contents(app_path('Ai/Support/AiPrompt.php'));

        $this->assertIsString($source);
        $this->assertStringNotContainsString('Mockery', $source);
        $this->assertStringNotContainsString('MockInterface', $source);
    }

    public function test_send_passes_only_prompt_when_signature_has_no_model(): void
    {
        $agent = new class
        {
            /** @var list<mixed> */
            public array $received = [];

            public function prompt(string $prompt): string
            {
                $this->received = func_get_args();

                return 'ok';
            }
        };

        $this->assertSame('ok', AiPrompt::send($agent, 'hello'));
        $this->assertSame(['hello'], $agent->received);
    }
}
