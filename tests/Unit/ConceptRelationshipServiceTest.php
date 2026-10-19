<?php

namespace Tests\Unit;

use App\Services\ConceptRelationshipService;
use Database\Seeders\ConceptSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Ai\Responses\AgentResponse;
use Laravel\Ai\Responses\StructuredAgentResponse;
use Mockery;
use Tests\TestCase;

class ConceptRelationshipServiceTest extends TestCase
{
    use RefreshDatabase;

    protected ConceptRelationshipService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = $this->app->make(ConceptRelationshipService::class);
    }

    public function test_generate_relationships_returns_normalized_structure(): void
    {
        $mockAgent = $this->mockAgentOnce($this->threeConceptGraph());

        $result = $this->service->generateRelationships('creativity', 3, $mockAgent);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('complexity', $result);
        $this->assertSame(3, $result['complexity']);
        $this->assertTrue($result['complete']);
        $this->assertSame('creativity', $result['start_concept']);
        $this->assertCount(3, $result['concepts']);
        $this->assertCount(3, $result['edges']);
        $this->assertEqualsWithDelta(0.5, $result['edges'][0]['laterality'], 0.001);
        $this->assertNull($result['concepts'][0]['wikiUrl']);
        $this->assertNull($result['concepts'][0]['mediaUrl']);
    }

    public function test_generate_relationships_uses_stored_record_when_concept_term_exists(): void
    {
        $this->seed(ConceptSeeder::class);

        $payload = $this->threeConceptGraph();
        $payload['concepts'] = array_slice($payload['concepts'], 0, 2);
        $payload['concepts'][] = [
            'concept' => 'chaos',
            'shortDescription' => 'Disorder that can lead to unexpected patterns',
            'complexity' => 3,
            'wikiUrl' => null,
            'mediaUrl' => null,
        ];
        $mockAgent = $this->mockAgentOnce($payload);

        $result = $this->service->generateRelationships('creativity', 3, $mockAgent);

        $this->assertEquals('https://en.wikipedia.org/wiki/Creativity', $result['concepts'][0]['wikiUrl']);
        $this->assertEquals('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg', $result['concepts'][0]['mediaUrl']);
        $this->assertEquals('https://en.wikipedia.org/wiki/Constraint', $result['concepts'][1]['wikiUrl']);
        $this->assertEquals('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Constraint.jpg/960px-Constraint.jpg', $result['concepts'][1]['mediaUrl']);
    }

    public function test_generate_relationships_handles_missing_fields_gracefully(): void
    {
        $mockAgent = $this->mockAgentOnce([
            'start_concept' => 'test',
            'concepts' => [
                ['concept' => 'test', 'shortDescription' => 'A test concept', 'wikiUrl' => null, 'mediaUrl' => null],
                ['concept' => 'related1', 'shortDescription' => 'First related concept'],
                ['concept' => 'related2', 'shortDescription' => 'Second related concept'],
            ],
            'edges' => [
                ['from' => 'test', 'to' => 'related1', 'laterality' => 0.5],
                ['from' => 'related1', 'to' => 'related2', 'laterality' => 0.45],
            ],
        ]);

        $result = $this->service->generateRelationships('test', 3, $mockAgent);

        $this->assertSame('test', $result['start_concept']);
        $this->assertCount(3, $result['concepts']);
        $this->assertCount(2, $result['edges']);
        $this->assertEquals('related1', $result['concepts'][1]['concept']);
        $this->assertEquals('First related concept', $result['concepts'][1]['shortDescription']);
    }

    public function test_generate_relationships_does_not_truncate_concept_labels_even_if_over_complexity_cap(): void
    {
        $long = "Benoît Mandelbrot's work on fractals in literature";
        $mockAgent = $this->mockAgentOnce([
            'start_concept' => 'creativity',
            'concepts' => [
                ['concept' => 'creativity', 'shortDescription' => 'Seed gloss.', 'complexity' => 2, 'wikiUrl' => null, 'mediaUrl' => null],
                ['concept' => $long, 'shortDescription' => 'A long-winded label example.', 'complexity' => 2, 'wikiUrl' => null, 'mediaUrl' => null],
                ['concept' => 'Harbor', 'shortDescription' => 'A sheltered port.', 'complexity' => 2, 'wikiUrl' => null, 'mediaUrl' => null],
            ],
            'edges' => [
                ['from' => 'creativity', 'to' => $long, 'laterality' => 0.5],
                ['from' => 'creativity', 'to' => 'Harbor', 'laterality' => 0.45],
            ],
        ]);

        $result = $this->service->generateRelationships('creativity', 3, $mockAgent, 2);

        $this->assertSame(2, $result['complexity']);
        $this->assertSame($long, $result['concepts'][1]['concept']);
    }

    public function test_generate_relationships_fills_empty_short_descriptions(): void
    {
        $mockAgent = $this->mockAgentOnce([
            'start_concept' => 'Kyoto',
            'concepts' => [
                ['concept' => 'Kyoto', 'shortDescription' => '', 'wikiUrl' => null, 'mediaUrl' => null],
                ['concept' => 'Marble', 'shortDescription' => '   ', 'wikiUrl' => null, 'mediaUrl' => null],
                ['concept' => 'Harbor', 'shortDescription' => 'A port.', 'wikiUrl' => null, 'mediaUrl' => null],
            ],
            'edges' => [
                ['from' => 'Kyoto', 'to' => 'Marble', 'laterality' => 0.5],
                ['from' => 'Kyoto', 'to' => 'Harbor', 'laterality' => 0.42],
            ],
        ]);

        $result = $this->service->generateRelationships('Kyoto', 3, $mockAgent);

        $this->assertStringContainsString('Kyoto', $result['concepts'][0]['shortDescription']);
        $this->assertStringContainsString('Marble', $result['concepts'][1]['shortDescription']);
    }

    public function test_generate_relationships_throws_exception_on_non_structured_response(): void
    {
        $mockResponse = Mockery::mock(AgentResponse::class);
        $mockResponse->shouldNotReceive('toArray');

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')->andReturn($mockResponse);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Expected structured response from agent');

        $this->service->generateRelationships('test', 3, $mockAgent);
    }

    public function test_generate_relationships_does_not_persist_or_attach_urls_when_no_stored_term(): void
    {
        $this->assertDatabaseCount('concepts', 0);

        $mockAgent = $this->mockAgentOnce([
            'start_concept' => 'newness',
            'concepts' => [
                ['concept' => 'newness', 'shortDescription' => 'Something new', 'wikiUrl' => null, 'mediaUrl' => null],
                ['concept' => 'Harbor', 'shortDescription' => 'A port.', 'wikiUrl' => null, 'mediaUrl' => null],
                ['concept' => 'Marble', 'shortDescription' => 'Stone.', 'wikiUrl' => null, 'mediaUrl' => null],
            ],
            'edges' => [
                ['from' => 'newness', 'to' => 'Harbor', 'laterality' => 0.5],
                ['from' => 'Harbor', 'to' => 'Marble', 'laterality' => 0.48],
            ],
        ]);

        $result = $this->service->generateRelationships('newness', 3, $mockAgent);

        $this->assertDatabaseCount('concepts', 0);
        $this->assertNull($result['concepts'][0]['wikiUrl']);
        $this->assertNull($result['concepts'][0]['mediaUrl']);
    }

    public function test_generate_relationships_with_null_seed_uses_random_seed(): void
    {
        $defaultSeeds = config('concepts.default_seeds', ['creativity']);
        $this->assertNotEmpty($defaultSeeds);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')
            ->once()
            ->withArgs(function (string $prompt) use ($defaultSeeds) {
                foreach ($defaultSeeds as $seed) {
                    if (str_contains($prompt, "\"{$seed}\"")) {
                        return true;
                    }
                }

                return false;
            })
            ->andReturn($this->structured($this->threeConceptGraph('creativity')));

        $result = $this->service->generateRelationships(null, 3, $mockAgent);

        $this->assertContains($result['start_concept'], array_merge($defaultSeeds, ['creativity']));
    }

    public function test_generate_relationships_accepts_explicit_complexity(): void
    {
        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')
            ->once()
            ->withArgs(function (string $prompt) {
                return str_contains($prompt, 'Target complexity for this request: **4**')
                    && str_contains($prompt, '0.40–0.60')
                    && ! str_contains($prompt, 'word-count caps')
                    && ! str_contains($prompt, 'At most 2 words');
            })
            ->andReturn($this->structured($this->threeConceptGraph('test', 4)));

        $result = $this->service->generateRelationships('test', 3, $mockAgent, 4);

        $this->assertSame(4, $result['complexity']);
    }

    public function test_edges_outside_the_band_are_dropped_and_topped_up(): void
    {
        $first = $this->structured([
            'start_concept' => 'Ball',
            'concepts' => [
                ['concept' => 'Ball', 'shortDescription' => 'A round toy.', 'complexity' => 3],
                ['concept' => 'Baseball', 'shortDescription' => 'A bat-and-ball sport.', 'complexity' => 3],
                ['concept' => 'Harbor', 'shortDescription' => 'A sheltered port.', 'complexity' => 3],
            ],
            'edges' => [
                ['from' => 'Ball', 'to' => 'Baseball', 'laterality' => 0.0],
                ['from' => 'Ball', 'to' => 'Harbor', 'laterality' => 0.5],
            ],
        ]);
        $second = $this->structured([
            'start_concept' => 'Ball',
            'concepts' => [
                ['concept' => 'Ball', 'shortDescription' => 'A round toy.', 'complexity' => 3],
                ['concept' => 'Harbor', 'shortDescription' => 'A sheltered port.', 'complexity' => 3],
                ['concept' => 'Fractals', 'shortDescription' => 'Self-similar patterns.', 'complexity' => 3],
            ],
            'edges' => [
                ['from' => 'Ball', 'to' => 'Harbor', 'laterality' => 0.5],
                ['from' => 'Harbor', 'to' => 'Fractals', 'laterality' => 0.55],
            ],
        ]);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')->twice()->andReturn($first, $second);

        $result = $this->service->generateRelationships('Ball', 3, $mockAgent, 3);

        $labels = collect($result['concepts'])->pluck('concept')->all();
        $this->assertContains('Ball', $labels);
        $this->assertContains('Harbor', $labels);
        $this->assertContains('Fractals', $labels);
        $this->assertNotContains('Baseball', $labels);
        $this->assertTrue($result['complete']);
        $this->assertGreaterThanOrEqual(2, $result['attempts']);
        $this->assertGreaterThanOrEqual(1, $result['shortfall']['rejected_laterality']);
        foreach ($result['edges'] as $edge) {
            $this->assertGreaterThanOrEqual(0.4, $edge['laterality']);
            $this->assertLessThanOrEqual(0.6, $edge['laterality']);
        }
    }

    public function test_concepts_outside_complexity_tolerance_are_dropped(): void
    {
        $payload = [
            'start_concept' => 'Ball',
            'concepts' => [
                ['concept' => 'Ball', 'shortDescription' => 'A round toy.', 'complexity' => 3],
                ['concept' => 'Harbor', 'shortDescription' => 'A sheltered port.', 'complexity' => 3],
                ['concept' => 'String theory', 'shortDescription' => 'A physics framework.', 'complexity' => 5],
            ],
            'edges' => [
                ['from' => 'Ball', 'to' => 'Harbor', 'laterality' => 0.5],
                ['from' => 'Ball', 'to' => 'String theory', 'laterality' => 0.5],
            ],
        ];
        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')->andReturn($this->structured($payload));

        $result = $this->service->generateRelationships('Ball', 3, $mockAgent, 3);

        $labels = collect($result['concepts'])->pluck('concept')->all();
        $this->assertContains('Ball', $labels);
        $this->assertContains('Harbor', $labels);
        $this->assertNotContains('String theory', $labels);
        $this->assertFalse($result['complete']);
        $this->assertGreaterThanOrEqual(1, $result['shortfall']['rejected_complexity']);
        $this->assertNotNull($result['shortfall']['message']);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function mockAgentOnce(array $payload): object
    {
        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')->once()->andReturn($this->structured($payload));

        return $mockAgent;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function structured(array $payload): StructuredAgentResponse
    {
        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')->andReturn($payload);

        return $mockResponse;
    }

    /**
     * @return array<string, mixed>
     */
    private function threeConceptGraph(string $start = 'creativity', int $complexity = 3): array
    {
        return [
            'start_concept' => $start,
            'concepts' => [
                [
                    'concept' => $start,
                    'shortDescription' => 'The use of imagination or original ideas to create something',
                    'complexity' => $complexity,
                    'wikiUrl' => 'https://evil.example/wiki',
                    'mediaUrl' => 'https://evil.example/media.jpg',
                ],
                [
                    'concept' => 'constraint',
                    'shortDescription' => 'Limitations that can spark creative solutions',
                    'complexity' => $complexity,
                    'wikiUrl' => null,
                    'mediaUrl' => null,
                ],
                [
                    'concept' => 'chaos',
                    'shortDescription' => 'Disorder that can lead to unexpected patterns',
                    'complexity' => $complexity,
                    'wikiUrl' => null,
                    'mediaUrl' => null,
                ],
            ],
            'edges' => [
                ['from' => $start, 'to' => 'constraint', 'laterality' => 0.5],
                ['from' => 'constraint', 'to' => 'chaos', 'laterality' => 0.45],
                ['from' => 'chaos', 'to' => $start, 'laterality' => 0.55],
            ],
        ];
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
