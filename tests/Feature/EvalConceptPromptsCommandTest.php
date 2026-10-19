<?php

namespace Tests\Feature;

use App\Services\ConceptPromptEvalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Ai\Responses\Data\Meta;
use Laravel\Ai\Responses\Data\Usage;
use Laravel\Ai\Responses\StructuredAgentResponse;
use Tests\TestCase;

class EvalConceptPromptsCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_eval_service_prints_distribution_with_faked_llm(): void
    {
        $fakeAgent = new class
        {
            public function prompt(string $prompt): StructuredAgentResponse
            {
                return new StructuredAgentResponse(
                    invocationId: 'eval',
                    structured: [
                        'start_concept' => 'Ball',
                        'concepts' => [
                            ['concept' => 'Ball', 'shortDescription' => 'A round toy.', 'complexity' => 3],
                            ['concept' => 'Harbor', 'shortDescription' => 'A sheltered port.', 'complexity' => 3],
                            ['concept' => 'Fractals', 'shortDescription' => 'Self-similar patterns.', 'complexity' => 3],
                        ],
                        'edges' => [
                            ['from' => 'Ball', 'to' => 'Harbor', 'laterality' => 0.5],
                            ['from' => 'Harbor', 'to' => 'Fractals', 'laterality' => 0.45],
                            ['from' => 'Fractals', 'to' => 'Ball', 'laterality' => 0.55],
                        ],
                    ],
                    text: '{}',
                    usage: new Usage,
                    meta: new Meta('test', 'test'),
                );
            }
        };

        $report = app(ConceptPromptEvalService::class)->run(
            seeds: ['Ball'],
            count: 3,
            complexity: 3,
            iterations: 1,
            agent: $fakeAgent,
        );

        $this->assertSame(['Ball', '3', '3', '1', '3.00', '0.45', '0.55', '1.00', '1.00'], $report['rows'][0]);
        $this->assertSame('100%', $report['summary']['count_hit_rate']);
        $this->assertSame('100%', $report['summary']['laterality_in_band_rate']);
        $this->assertSame('100%', $report['summary']['complexity_in_tol_rate']);
        $this->assertSame(1, $report['summary']['complexity_tolerance']);
    }

    public function test_artisan_command_prints_summary(): void
    {
        $this->mock(ConceptPromptEvalService::class, function ($mock): void {
            $mock->shouldReceive('run')->once()->andReturn([
                'rows' => [['Ball', '3', '3', '1', '3.00', '0.45', '0.55', '1.00', '1.00']],
                'summary' => [
                    'count_hit_rate' => '100%',
                    'laterality_in_band_rate' => '100%',
                    'complexity_in_tol_rate' => '100%',
                    'complexity_tolerance' => 1,
                ],
            ]);
        });

        $this->artisan('concepts:eval-prompts', ['--seed' => 'Ball'])
            ->expectsOutputToContain('count hit rate: 100%')
            ->expectsOutputToContain('laterality in band: 100%')
            ->expectsOutputToContain('complexity within ±1: 100%')
            ->assertSuccessful();
    }

    public function test_default_complexity_is_three(): void
    {
        $this->assertSame(3, (int) config('concepts.default_complexity'));
        $this->assertEqualsWithDelta(0.4, (float) config('concepts.laterality_band_min'), 0.001);
        $this->assertEqualsWithDelta(0.6, (float) config('concepts.laterality_band_max'), 0.001);
        $this->assertSame(3, (int) config('concepts.default_complexity', 2));
    }
}
