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
                'seed' => [
                    'concept' => 'creativity',
                    'shortDescription' => 'The use of imagination or original ideas to create something',
                    'wikiUrl' => null,
                    'mediaUrl' => null,
                ],
                'related_concepts' => [
                    [
                        'concept' => 'constraint',
                        'shortDescription' => 'Limitations that can spark creative solutions',
                        'larelality' => 3,
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                    [
                        'concept' => 'chaos',
                        'shortDescription' => 'Disorder that can lead to unexpected patterns',
                        'larelality' => 4,
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                    [
                        'concept' => 'silence',
                        'shortDescription' => 'Empty spaces that allow ideas to emerge',
                        'larelality' => 4,
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                ],
            ]);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')
            ->once()
            ->andReturn($mockResponse);

        $result = $this->service->generateRelationships('creativity', null, $mockAgent);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('seed', $result);
        $this->assertArrayHasKey('related_concepts', $result);

        $this->assertIsArray($result['seed']);
        $this->assertArrayHasKey('concept', $result['seed']);
        $this->assertArrayHasKey('shortDescription', $result['seed']);
        $this->assertArrayHasKey('wikiUrl', $result['seed']);
        $this->assertArrayHasKey('mediaUrl', $result['seed']);
        $this->assertEquals('creativity', $result['seed']['concept']);
        $this->assertNotNull($result['seed']['wikiUrl']);
        $this->assertNotNull($result['seed']['mediaUrl']);

        $this->assertCount(3, $result['related_concepts']);

        $firstConcept = $result['related_concepts'][0];
        $this->assertArrayHasKey('concept', $firstConcept);
        $this->assertArrayHasKey('shortDescription', $firstConcept);
        $this->assertArrayHasKey('larelality', $firstConcept);
        $this->assertArrayHasKey('wikiUrl', $firstConcept);
        $this->assertArrayHasKey('mediaUrl', $firstConcept);
        $this->assertEquals('constraint', $firstConcept['concept']);
        $this->assertEquals('Limitations that can spark creative solutions', $firstConcept['shortDescription']);
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
                'seed' => [
                    'concept' => 'creativity',
                    'shortDescription' => 'The use of imagination or original ideas to create something',
                    'wikiUrl' => null,
                    'mediaUrl' => null,
                ],
                'related_concepts' => [
                    [
                        'concept' => 'constraint',
                        'shortDescription' => 'Limitations that can spark creative solutions',
                        'larelality' => 3,
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                ],
            ]);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')->once()->andReturn($mockResponse);

        $result = $this->service->generateRelationships('creativity', null, $mockAgent);

        $this->assertEquals('https://en.wikipedia.org/wiki/Creativity', $result['seed']['wikiUrl']);
        $this->assertEquals('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg', $result['seed']['mediaUrl']);
        $this->assertEquals('https://en.wikipedia.org/wiki/Constraint', $result['related_concepts'][0]['wikiUrl']);
        $this->assertEquals('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Constraint.jpg/960px-Constraint.jpg', $result['related_concepts'][0]['mediaUrl']);
    }

    public function test_generate_relationships_handles_missing_fields_gracefully(): void
    {
        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')
            ->once()
            ->andReturn([
                'seed' => [
                    'concept' => 'test',
                    'shortDescription' => 'A test concept',
                    'wikiUrl' => null,
                    'mediaUrl' => null,
                ],
                'related_concepts' => [
                    [
                        'concept' => 'related1',
                        'shortDescription' => 'First related concept',
                        'larelality' => 2,
                    ],
                    [
                        'concept' => 'related2',
                        'shortDescription' => 'Second related concept',
                        'larelality' => 3,
                    ],
                ],
            ]);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')->andReturn($mockResponse);

        $result = $this->service->generateRelationships('test', null, $mockAgent);

        $this->assertIsArray($result['seed']);
        $this->assertEquals('test', $result['seed']['concept']);
        $this->assertCount(2, $result['related_concepts']);
        $this->assertEquals('related1', $result['related_concepts'][0]['concept']);
        $this->assertEquals('First related concept', $result['related_concepts'][0]['shortDescription']);
        $this->assertArrayHasKey('larelality', $result['related_concepts'][0]);
        $this->assertArrayHasKey('wikiUrl', $result['related_concepts'][0]);
        $this->assertArrayHasKey('mediaUrl', $result['related_concepts'][0]);
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
                'seed' => [
                    'concept' => 'newness',
                    'shortDescription' => 'Something new',
                    'wikiUrl' => null,
                    'mediaUrl' => null,
                ],
                'related_concepts' => [],
            ]);

        $mockAgent = Mockery::mock(\App\Ai\Agents\ConceptsOnlyAgent::class);
        $mockAgent->shouldReceive('prompt')->once()->andReturn($mockResponse);

        $this->service->generateRelationships('newness', null, $mockAgent);

        $this->assertDatabaseCount('concepts', 1);
        $this->assertDatabaseHas('concepts', [
            'concept' => 'newness',
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
                'seed' => [
                    'concept' => 'creativity',
                    'shortDescription' => 'Cold start seed',
                    'wikiUrl' => null,
                    'mediaUrl' => null,
                ],
                'related_concepts' => [],
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
        $this->assertArrayHasKey('seed', $result);
        $this->assertArrayHasKey('related_concepts', $result);
        $this->assertContains($result['seed']['concept'], $defaultSeeds);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
