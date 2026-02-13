<?php

namespace Tests\Unit;

use App\Services\ConceptRelationshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
                        'rationale' => 'Limitations can spark creative solutions',
                        'strength' => 0.8,
                    ],
                    [
                        'concept' => 'chaos',
                        'rationale' => 'Disorder can lead to unexpected patterns',
                        'strength' => 0.7,
                    ],
                    [
                        'concept' => 'silence',
                        'rationale' => 'Empty spaces allow ideas to emerge',
                        'strength' => 0.6,
                    ],
                ],
            ]);

        // Mock the agent
        $mockAgent = Mockery::mock('alias:App\Ai\Agents\ConceptRelationshipAgent');
        $mockAgent->shouldReceive('make')
            ->once()
            ->andReturnSelf();
        $mockAgent->shouldReceive('prompt')
            ->once()
            ->andReturn($mockResponse);

        $result = $this->service->generateRelationships('creativity');

        $this->assertIsArray($result);
        $this->assertArrayHasKey('seed', $result);
        $this->assertArrayHasKey('related_concepts', $result);
        $this->assertEquals('creativity', $result['seed']);
        $this->assertCount(3, $result['related_concepts']);

        $firstConcept = $result['related_concepts'][0];
        $this->assertArrayHasKey('concept', $firstConcept);
        $this->assertArrayHasKey('rationale', $firstConcept);
        $this->assertArrayHasKey('strength', $firstConcept);
        $this->assertEquals('constraint', $firstConcept['concept']);
        $this->assertEquals(0.8, $firstConcept['strength']);
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
                        // Missing rationale and strength
                    ],
                    [
                        'concept' => 'related2',
                        'rationale' => 'Some rationale',
                        // Missing strength
                    ],
                ],
            ]);

        $mockAgent = Mockery::mock('alias:App\Ai\Agents\ConceptRelationshipAgent');
        $mockAgent->shouldReceive('make')->andReturnSelf();
        $mockAgent->shouldReceive('prompt')->andReturn($mockResponse);

        $result = $this->service->generateRelationships('test');

        $this->assertEquals('test', $result['seed']);
        $this->assertCount(2, $result['related_concepts']);
        $this->assertNull($result['related_concepts'][0]['rationale']);
        $this->assertNull($result['related_concepts'][0]['strength']);
        $this->assertEquals('Some rationale', $result['related_concepts'][1]['rationale']);
        $this->assertNull($result['related_concepts'][1]['strength']);
    }

    public function test_generate_relationships_throws_exception_on_non_structured_response(): void
    {
        $mockAgent = Mockery::mock('alias:App\Ai\Agents\ConceptRelationshipAgent');
        $mockAgent->shouldReceive('make')->andReturnSelf();
        $mockAgent->shouldReceive('prompt')->andReturn('not a structured response');

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Expected structured response from agent');

        $this->service->generateRelationships('test');
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
