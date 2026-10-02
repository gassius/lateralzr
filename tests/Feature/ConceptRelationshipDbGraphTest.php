<?php

namespace Tests\Feature;

use App\Models\Concept;
use App\Models\ConceptMedia;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('db-graph')]
class ConceptRelationshipDbGraphTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeded_neighborhood_returns_live_graph_keys(): void
    {
        $this->seedNeighborhood();

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'complexity' => 2,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
            ])
            ->assertJsonStructure([
                'data' => [
                    'start' => [
                        'id',
                        'label',
                    ],
                    'nodes' => [
                        '*' => [
                            'id',
                            'label',
                            'shortDescription',
                            'complexity',
                            'wikiUrl',
                            'mediaUrl',
                            'media' => [
                                '*' => [
                                    'url',
                                    'kind',
                                    'license',
                                ],
                            ],
                            'locale',
                            'degree',
                        ],
                    ],
                    'edges' => [
                        '*' => [
                            'id',
                            'from',
                            'to',
                            'strength',
                            'laterality',
                        ],
                    ],
                    'meta' => [
                        'depth',
                        'limit',
                        'minStrength',
                        'hasMore',
                        'locale',
                        'complexity',
                    ],
                ],
                'status',
            ])
            ->assertJsonPath('data.meta.locale', 'en')
            ->assertJsonPath('data.meta.complexity', 2)
            ->assertJsonPath('data.start.label', 'creativity');

        $data = $response->json('data');
        $this->assertIsArray($data['nodes']);
        $this->assertIsArray($data['edges']);
        $this->assertGreaterThan(0, count($data['nodes']));
        $this->assertGreaterThan(0, count($data['edges']));

        foreach ($data['nodes'] as $node) {
            $this->assertSame('en', $node['locale']);
            $this->assertIsArray($node['media']);
            $this->assertNotEmpty($node['media']);
            $this->assertArrayHasKey('url', $node['media'][0]);
            $this->assertArrayHasKey('kind', $node['media'][0]);
            $this->assertArrayHasKey('license', $node['media'][0]);
        }
    }

    private function seedNeighborhood(): void
    {
        $creativity = $this->makeConcept(
            'creativity',
            'creativity',
            'https://example.com/creativity.jpg',
        );
        $silence = $this->makeConcept(
            'silence',
            'silence',
            'https://example.com/silence.jpg',
        );

        ConceptRelationship::query()->create([
            'from_concept_id' => $creativity->id,
            'to_concept_id' => $silence->id,
            'strength' => 0.8,
            'last_laterality' => 3,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);
    }

    private function makeConcept(string $canonical, string $term, string $mediaUrl): Concept
    {
        $concept = Concept::query()->create(['canonical_key' => $canonical]);

        ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => 'en',
            'term' => $term,
            'normalized_term' => ConceptTerm::normalizeTerm($term),
            'short_description' => $term.' desc',
            'complexity' => 2,
            'is_preferred' => true,
            'media_url' => $mediaUrl,
        ]);

        ConceptMedia::query()->create([
            'concept_id' => $concept->id,
            'url' => $mediaUrl,
            'kind' => 'image',
            'license' => 'CC0',
            'source' => 'wikimedia',
            'position' => 0,
        ]);

        return $concept;
    }
}
