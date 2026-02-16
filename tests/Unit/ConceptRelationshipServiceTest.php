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
                'seed' => [
                    'concept' => 'creativity',
                    'shortDescription' => 'The use of imagination or original ideas to create something',
                    'wikiUrl' => 'https://en.wikipedia.org/wiki/Creativity',
                    'mediaUrl' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg',
                ],
                'related_concepts' => [
                    [
                        'concept' => 'constraint',
                        'shortDescription' => 'Limitations that can spark creative solutions',
                        'larelality' => 3,
                        'wikiUrl' => 'https://en.wikipedia.org/wiki/Constraint',
                        'mediaUrl' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Constraint.jpg/960px-Constraint.jpg',
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

        // Mock the agent
        $mockAgent = Mockery::mock(ConceptRelationshipAgent::class);
        $mockAgent->shouldReceive('prompt')
            ->once()
            ->andReturn($mockResponse);

        $result = $this->service->generateRelationships('creativity', null, $mockAgent);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('seed', $result);
        $this->assertArrayHasKey('related_concepts', $result);
        
        // Check seed structure
        $this->assertIsArray($result['seed']);
        $this->assertArrayHasKey('concept', $result['seed']);
        $this->assertArrayHasKey('shortDescription', $result['seed']);
        $this->assertArrayHasKey('wikiUrl', $result['seed']);
        $this->assertArrayHasKey('mediaUrl', $result['seed']);
        $this->assertEquals('creativity', $result['seed']['concept']);
        
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

        $mockAgent = Mockery::mock(ConceptRelationshipAgent::class);
        $mockAgent->shouldReceive('prompt')->andReturn($mockResponse);

        $result = $this->service->generateRelationships('test', null, $mockAgent);

        $this->assertIsArray($result['seed']);
        $this->assertEquals('test', $result['seed']['concept']);
        $this->assertCount(2, $result['related_concepts']);
        $this->assertEquals('related1', $result['related_concepts'][0]['concept']);
        $this->assertEquals('First related concept', $result['related_concepts'][0]['shortDescription']);
        $this->assertArrayHasKey('larelality', $result['related_concepts'][0]);
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
