<?php

namespace Tests\Unit;

use App\Ai\Agents\ConceptRelationshipAgent;
use App\Services\ConceptRelationshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
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
        // Mock HTTP calls for tools
        Http::fake(function ($request) {
            $url = $request->url();
            
            // Wikipedia API
            if (str_contains($url, 'en.wikipedia.org/api/rest_v1/page/summary')) {
                return Http::response([
                    'content_urls' => [
                        'desktop' => [
                            'page' => 'https://en.wikipedia.org/wiki/Constraint',
                        ],
                    ],
                ], 200);
            }
            
            // Wikimedia Commons search API
            if (str_contains($url, 'commons.wikimedia.org/w/api.php') && str_contains($url, 'list=search')) {
                return Http::response([
                    'query' => [
                        'search' => [
                            ['title' => 'File:Constraint.jpg'],
                        ],
                    ],
                ], 200);
            }
            
            // Wikimedia Commons imageinfo API (for thumbnails)
            if (str_contains($url, 'commons.wikimedia.org/w/api.php') && str_contains($url, 'prop=imageinfo')) {
                return Http::response([
                    'query' => [
                        'pages' => [
                            '-1' => [
                                'title' => 'File:Constraint.jpg',
                                'imageinfo' => [
                                    [
                                        'thumburl' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Constraint.jpg/960px-Constraint.jpg',
                                        'url' => 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Constraint.jpg',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ], 200);
            }
            
            return Http::response([], 404);
        });

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
                    ],
                    [
                        'concept' => 'chaos',
                        'shortDescription' => 'Disorder that can lead to unexpected patterns',
                    ],
                    [
                        'concept' => 'silence',
                        'shortDescription' => 'Empty spaces that allow ideas to emerge',
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
        $this->assertArrayHasKey('wikiUrl', $firstConcept);
        $this->assertArrayHasKey('mediaUrl', $firstConcept);
        $this->assertEquals('constraint', $firstConcept['concept']);
        $this->assertEquals('Limitations that can spark creative solutions', $firstConcept['shortDescription']);
        $this->assertNotNull($firstConcept['wikiUrl']);
        $this->assertNotNull($firstConcept['mediaUrl']);
    }

    public function test_generate_relationships_handles_missing_fields_gracefully(): void
    {
        // Mock HTTP calls for tools (return empty responses to simulate failures)
        Http::fake([
            'en.wikipedia.org/api/rest_v1/page/summary/*' => Http::response([], 404),
            'commons.wikimedia.org/w/api.php*' => Http::response([], 404),
        ]);

        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')
            ->once()
            ->andReturn([
                'seed' => 'test',
                'related_concepts' => [
                    [
                        'concept' => 'related1',
                        'shortDescription' => 'First related concept',
                    ],
                    [
                        'concept' => 'related2',
                        'shortDescription' => 'Second related concept',
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
        // URLs may be null if tools fail
        $this->assertArrayHasKey('wikiUrl', $result['related_concepts'][0]);
        $this->assertArrayHasKey('mediaUrl', $result['related_concepts'][0]);
    }

    public function test_generate_relationships_handles_tool_failures_gracefully(): void
    {
        // Mock HTTP calls to fail
        Http::fake([
            'en.wikipedia.org/api/rest_v1/page/summary/*' => Http::response([], 500),
            'commons.wikimedia.org/w/api.php*' => Http::response([], 500),
        ]);

        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')
            ->once()
            ->andReturn([
                'seed' => 'test',
                'related_concepts' => [
                    [
                        'concept' => 'testconcept',
                        'shortDescription' => 'A test concept',
                    ],
                ],
            ]);

        $mockAgent = Mockery::mock(ConceptRelationshipAgent::class);
        $mockAgent->shouldReceive('prompt')->andReturn($mockResponse);

        $result = $this->service->generateRelationships('test', null, $mockAgent);

        $this->assertEquals('test', $result['seed']);
        $this->assertCount(1, $result['related_concepts']);
        // URLs should be null when tools fail
        $this->assertNull($result['related_concepts'][0]['wikiUrl']);
        $this->assertNull($result['related_concepts'][0]['mediaUrl']);
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
