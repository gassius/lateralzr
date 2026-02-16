<?php

namespace Tests\Unit;

use App\Ai\Agents\ConceptRelationshipAgent;
use App\Services\ConceptRelationshipService;
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
        $this->service = new ConceptRelationshipService;
    }

    public function test_generate_relationships_returns_normalized_structure(): void
    {
        // Mock the agent response
        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')
            ->once()
            ->andReturn([
                'seed' => 'creativity',
                'related_concepts' => [
                    [
                        'concept' => 'constraint',
                        'shortDescription' => 'Limitations that can spark creative solutions',
                        'laterality' => 3,
                        'wikiUrl' => 'https://en.wikipedia.org/wiki/Constraint',
                        'mediaUrl' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Constraint.jpg/960px-Constraint.jpg',
                    ],
                    [
                        'concept' => 'chaos',
                        'shortDescription' => 'Disorder that can lead to unexpected patterns',
                        'laterality' => 4,
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                    [
                        'concept' => 'silence',
                        'shortDescription' => 'Empty spaces that allow ideas to emerge',
                        'laterality' => 4,
                        'wikiUrl' => null,
                        'mediaUrl' => null,
                    ],
                ],
            ]);

        // Mock the agent
        $mockAgent = Mockery::mock(ConceptRelationshipAgent::class);
        $mockAgent->shouldReceive('prompt')
            ->once()
            ->andReturn($mockResponse);

        $result = $this->service->generateRelationships('creativity', null, $mockAgent);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('seed', $result);
        $this->assertArrayHasKey('related_concepts', $result);
        $this->assertEquals('creativity', $result['seed']);
        $this->assertCount(3, $result['related_concepts']);

        $firstConcept = $result['related_concepts'][0];
        $this->assertArrayHasKey('concept', $firstConcept);
        $this->assertArrayHasKey('shortDescription', $firstConcept);
        $this->assertArrayHasKey('laterality', $firstConcept);
        $this->assertArrayHasKey('wikiUrl', $firstConcept);
        $this->assertArrayHasKey('mediaUrl', $firstConcept);
        $this->assertEquals('constraint', $firstConcept['concept']);
        $this->assertEquals('Limitations that can spark creative solutions', $firstConcept['shortDescription']);
        $this->assertNotNull($firstConcept['wikiUrl']);
        $this->assertNotNull($firstConcept['mediaUrl']);
    }

    public function test_generate_relationships_handles_missing_fields_gracefully(): void
    {
        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')
            ->once()
            ->andReturn([
                'seed' => 'test',
                'related_concepts' => [
                    [
                        'concept' => 'related1',
                        'shortDescription' => 'First related concept',
                        'laterality' => 2,
                    ],
                    [
                        'concept' => 'related2',
                        'shortDescription' => 'Second related concept',
                        'laterality' => 3,
                    ],
                ],
            ]);

        $mockAgent = Mockery::mock(ConceptRelationshipAgent::class);
        $mockAgent->shouldReceive('prompt')->andReturn($mockResponse);

        $result = $this->service->generateRelationships('test', null, $mockAgent);

        $this->assertEquals('test', $result['seed']);
        $this->assertCount(2, $result['related_concepts']);
        $this->assertEquals('related1', $result['related_concepts'][0]['concept']);
        $this->assertEquals('First related concept', $result['related_concepts'][0]['shortDescription']);
        $this->assertArrayHasKey('laterality', $result['related_concepts'][0]);
    }

    public function test_generate_relationships_throws_exception_on_non_structured_response(): void
    {
        // Mock a non-structured AgentResponse
        $mockResponse = Mockery::mock(AgentResponse::class);
        $mockResponse->shouldNotReceive('toArray');

        $mockAgent = Mockery::mock(ConceptRelationshipAgent::class);
        $mockAgent->shouldReceive('prompt')->andReturn($mockResponse);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Expected structured response from agent');

        $this->service->generateRelationships('test', null, $mockAgent);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
