<?php

namespace Tests\Unit;

use App\Ai\Tools\WikimediaCommonsSearchTool;
use App\Ai\Tools\WikipediaSearchTool;
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

        $wikiMock = Mockery::mock(WikipediaSearchTool::class);
        $wikiMock->shouldReceive('handle')->andReturn('https://en.wikipedia.org/wiki/Test');

        $commonsMock = Mockery::mock(WikimediaCommonsSearchTool::class);
        $commonsMock->shouldReceive('handle')->andReturn('https://upload.wikimedia.org/wikipedia/commons/thumb/test.jpg/960px-test.jpg');

        $this->app->instance(WikipediaSearchTool::class, $wikiMock);
        $this->app->instance(WikimediaCommonsSearchTool::class, $commonsMock);

        $this->service = $this->app->make(ConceptRelationshipService::class);
    }

    public function test_generate_relationships_returns_normalized_structure(): void
    {
        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')
            ->once()
            ->andReturn([
                'start_concept' => 'creativity',
                'concepts' => [
                    [
                        'concept' => 'creativity',
                        'shortDescription' => 'The use of imagination or original ideas to create something',
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                    [
                        'concept' => 'constraint',
                        'shortDescription' => 'Limitations that can spark creative solutions',
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                    [
                        'concept' => 'chaos',
                        'shortDescription' => 'Disorder that can lead to unexpected patterns',
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                ],
                'edges' => [
                    ['from' => 'creativity', 'to' => 'constraint', 'laterality' => 3],
                    ['from' => 'constraint', 'to' => 'chaos', 'laterality' => 4],
                    ['from' => 'chaos', 'to' => 'creativity', 'laterality' => 5],
                ],
            ]);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')
            ->once()
            ->andReturn($mockResponse);

        $result = $this->service->generateRelationships('creativity', null, $mockAgent);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('complexity', $result);
        $this->assertSame(2, $result['complexity']);
        $this->assertArrayHasKey('start_concept', $result);
        $this->assertArrayHasKey('concepts', $result);
        $this->assertArrayHasKey('edges', $result);

        $this->assertSame('creativity', $result['start_concept']);

        $this->assertCount(3, $result['concepts']);
        $this->assertCount(3, $result['edges']);

        $firstConcept = $result['concepts'][0];
        $this->assertArrayHasKey('concept', $firstConcept);
        $this->assertArrayHasKey('shortDescription', $firstConcept);
        $this->assertArrayHasKey('wikiUrl', $firstConcept);
        $this->assertArrayHasKey('mediaUrl', $firstConcept);
        $this->assertNotNull($firstConcept['wikiUrl']);
        $this->assertNotNull($firstConcept['mediaUrl']);
    }

    public function test_generate_relationships_uses_stored_record_when_concept_in_cache(): void
    {
        $this->seed(ConceptSeeder::class);

        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')
            ->once()
            ->andReturn([
                'start_concept' => 'creativity',
                'concepts' => [
                    [
                        'concept' => 'creativity',
                        'shortDescription' => 'The use of imagination or original ideas to create something',
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                    [
                        'concept' => 'constraint',
                        'shortDescription' => 'Limitations that can spark creative solutions',
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                ],
                'edges' => [
                    ['from' => 'creativity', 'to' => 'constraint', 'laterality' => 3],
                ],
            ]);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')->once()->andReturn($mockResponse);

        $result = $this->service->generateRelationships('creativity', null, $mockAgent);

        $this->assertEquals('https://en.wikipedia.org/wiki/Creativity', $result['concepts'][0]['wikiUrl']);
        $this->assertEquals('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg', $result['concepts'][0]['mediaUrl']);
        $this->assertEquals('https://en.wikipedia.org/wiki/Constraint', $result['concepts'][1]['wikiUrl']);
        $this->assertEquals('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Constraint.jpg/960px-Constraint.jpg', $result['concepts'][1]['mediaUrl']);
    }

    public function test_generate_relationships_handles_missing_fields_gracefully(): void
    {
        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')
            ->once()
            ->andReturn([
                'start_concept' => 'test',
                'concepts' => [
                    [
                        'concept' => 'test',
                        'shortDescription' => 'A test concept',
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                    [
                        'concept' => 'related1',
                        'shortDescription' => 'First related concept',
                    ],
                    [
                        'concept' => 'related2',
                        'shortDescription' => 'Second related concept',
                    ],
                ],
                'edges' => [
                    ['from' => 'test', 'to' => 'related1', 'laterality' => 2],
                    ['from' => 'related1', 'to' => 'related2', 'laterality' => 3],
                ],
            ]);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')->andReturn($mockResponse);

        $result = $this->service->generateRelationships('test', null, $mockAgent);

        $this->assertSame('test', $result['start_concept']);
        $this->assertCount(3, $result['concepts']);
        $this->assertCount(2, $result['edges']);
        $this->assertEquals('related1', $result['concepts'][1]['concept']);
        $this->assertEquals('First related concept', $result['concepts'][1]['shortDescription']);
        $this->assertArrayHasKey('wikiUrl', $result['concepts'][1]);
        $this->assertArrayHasKey('mediaUrl', $result['concepts'][1]);
    }

    public function test_generate_relationships_does_not_truncate_concept_labels_even_if_over_complexity_cap(): void
    {
        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')
            ->once()
            ->andReturn([
                'start_concept' => 'creativity',
                'concepts' => [
                    [
                        'concept' => 'creativity',
                        'shortDescription' => 'Seed gloss.',
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                    [
                        'concept' => "Benoît Mandelbrot's work on fractals in literature",
                        'shortDescription' => 'A long-winded label example.',
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                ],
                'edges' => [
                    ['from' => 'creativity', 'to' => "Benoît Mandelbrot's work on fractals in literature", 'laterality' => 3],
                ],
            ]);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')->andReturn($mockResponse);

        $result = $this->service->generateRelationships('creativity', null, $mockAgent, 2);

        $this->assertSame(2, $result['complexity']);
        $this->assertSame("Benoît Mandelbrot's work on fractals in literature", $result['concepts'][1]['concept']);
    }

    public function test_generate_relationships_fills_empty_short_descriptions(): void
    {
        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')
            ->once()
            ->andReturn([
                'start_concept' => 'Kyoto',
                'concepts' => [
                    [
                        'concept' => 'Kyoto',
                        'shortDescription' => '',
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                    [
                        'concept' => 'Marble',
                        'shortDescription' => '   ',
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                ],
                'edges' => [
                    ['from' => 'Kyoto', 'to' => 'Marble', 'laterality' => 3],
                ],
            ]);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')->andReturn($mockResponse);

        $result = $this->service->generateRelationships('Kyoto', null, $mockAgent);

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

        $this->service->generateRelationships('test', null, $mockAgent);
    }

    public function test_generate_relationships_creates_new_record_when_concept_not_in_cache(): void
    {
        $this->assertDatabaseCount('concepts', 0);

        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')
            ->once()
            ->andReturn([
                'start_concept' => 'newness',
                'concepts' => [
                    [
                        'concept' => 'newness',
                        'shortDescription' => 'Something new',
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                ],
                'edges' => [],
            ]);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')->once()->andReturn($mockResponse);

        $this->service->generateRelationships('newness', null, $mockAgent);

        $this->assertDatabaseCount('concepts', 1);
        $this->assertDatabaseHas('concept_terms', [
            'locale' => config('concepts.default_locale', 'en'),
            'normalized_term' => \App\Models\ConceptTerm::normalizeTerm('newness'),
        ]);
    }

    public function test_generate_relationships_with_null_seed_uses_random_seed(): void
    {
        $defaultSeeds = config('concepts.default_seeds', ['creativity']);
        $this->assertNotEmpty($defaultSeeds);

        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')
            ->once()
            ->andReturn([
                'start_concept' => 'creativity',
                'concepts' => [
                    [
                        'concept' => 'creativity',
                        'shortDescription' => 'Cold start seed',
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                ],
                'edges' => [],
            ]);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')
            ->once()
            ->with(Mockery::on(function (string $prompt) use ($defaultSeeds) {
                foreach ($defaultSeeds as $seed) {
                    if (str_contains($prompt, "\"{$seed}\"")) {
                        return true;
                    }
                }

                return false;
            }))
            ->andReturn($mockResponse);

        $result = $this->service->generateRelationships(null, null, $mockAgent);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('start_concept', $result);
        $this->assertArrayHasKey('concepts', $result);
        $this->assertArrayHasKey('edges', $result);
        $this->assertContains($result['start_concept'], $defaultSeeds);
    }

    public function test_generate_relationships_accepts_explicit_complexity(): void
    {
        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')
            ->once()
            ->andReturn([
                'start_concept' => 'test',
                'concepts' => [
                    [
                        'concept' => 'test',
                        'shortDescription' => 'Desc',
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                ],
                'edges' => [],
            ]);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')
            ->once()
            ->with(Mockery::on(function (string $prompt) {
                return str_contains($prompt, 'Target complexity for this request: **4**');
            }))
            ->andReturn($mockResponse);

        $result = $this->service->generateRelationships('test', null, $mockAgent, 4);

        $this->assertSame(4, $result['complexity']);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
