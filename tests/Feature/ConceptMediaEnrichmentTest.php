<?php

namespace Tests\Feature;

use App\Models\Concept;
use App\Models\ConceptMedia;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Services\ConceptCompleteInfoService;
use App\Services\ConceptGraphQuery;
use App\Services\Enrichment\WikipediaArticleResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class ConceptMediaEnrichmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_giza_solar_boat_gets_khufu_ship_and_only_qualifying_media(): void
    {
        Http::fake(function (Request $request) {
            return Http::response($this->wikimediaPayload($request), 200);
        });

        $term = $this->makeTerm(
            'giza solar boat',
            'Ancient Egyptian wooden ship buried beside the Great Pyramid of Khufu at Giza, built to carry the pharaoh in the afterlife.',
        );
        $other = $this->makeTerm('pyramid', 'A monumental tomb.');
        ConceptRelationship::query()->create([
            'from_concept_id' => $term->concept_id,
            'to_concept_id' => $other->concept_id,
            'strength' => 0.8,
            'last_laterality' => 3,
            'llm_occurrences' => 1,
        ]);

        $stats = app(ConceptCompleteInfoService::class)->complete([$term->id], 'both');

        $this->assertSame(1, $stats['wikiUpdated']);
        $this->assertSame(1, $stats['mediaUpdated']);
        $this->assertSame(0, $stats['failed']);

        $term->refresh();
        $this->assertSame('https://en.wikipedia.org/wiki/Khufu_ship', $term->wiki_url);
        $this->assertNotNull($term->media_url);
        $this->assertStringStartsWith('https://upload.wikimedia.org/', (string) $term->media_url);
        $this->assertStringNotContainsString('.webm', (string) $term->media_url);
        $this->assertStringNotContainsString('attribution', (string) $term->media_url);
        $this->assertStringNotContainsString('Barque_Solaire', (string) $term->media_url);
        $this->assertStringNotContainsString('Galley', (string) $term->media_url);

        $stored = ConceptMedia::query()->where('concept_id', $term->concept_id)->orderBy('position')->get();
        $this->assertCount(3, $stored);
        $this->assertEqualsCanonicalizing(
            ['CC0', 'Public domain'],
            $stored->pluck('license')->unique()->sort()->values()->all()
        );
        $this->assertTrue($stored->contains(fn (ConceptMedia $media) => $media->kind === 'clip' && str_ends_with($media->url, '.webm')));
        $this->assertTrue($stored->contains(fn (ConceptMedia $media) => str_contains($media->url, 'GEM_Khufus_Boat_front_2025.jpg')));
        $this->assertFalse($stored->contains(fn (ConceptMedia $media) => str_contains($media->url, 'Barque_Solaire')));
        $this->assertFalse($stored->contains(fn (ConceptMedia $media) => str_contains($media->url, 'attribution')));

        $graph = app(ConceptGraphQuery::class)->getGraph('giza solar boat', 10, 1);
        $this->assertNotNull($graph);
        $node = collect($graph['nodes'])->firstWhere('id', $term->concept_id);
        $this->assertIsArray($node);
        $this->assertSame($term->media_url, $node['mediaUrl']);
        $this->assertCount(3, $node['media']);
        $this->assertContains('clip', array_column($node['media'], 'kind'));
    }

    public function test_spanish_term_uses_the_local_wikipedia_article(): void
    {
        Http::fake(function (Request $request) {
            $params = $this->params($request);
            $host = (string) parse_url($request->url(), PHP_URL_HOST);

            if ($host === 'es.wikipedia.org' && ($params['generator'] ?? '') === 'search') {
                return Http::response([
                    'query' => [
                        'pages' => [
                            '1' => [
                                'title' => 'Museo de la barca de Keops',
                                'index' => 2,
                                'extract' => 'El Museo de la barca de Keops fue un museo construido alrededor de 1985. Estaba dedicado a la exhibición de la restaurada barca funeraria de Keops.',
                            ],
                            '2' => [
                                'title' => 'Barca funeraria de Keops',
                                'index' => 1,
                                'extract' => 'La barca funeraria de Keops (o barca solar) es un navío de 43,4 m de eslora del Antiguo Egipto que fue enterrado en un foso a los pies de la Gran Pirámide de Keops en Guiza.',
                            ],
                        ],
                    ],
                ], 200);
            }

            if (($params['prop'] ?? '') === 'langlinks') {
                return Http::response([
                    'query' => [
                        'pages' => [
                            '2' => [
                                'title' => 'Barca funeraria de Keops',
                                'langlinks' => [
                                    ['lang' => 'en', '*' => 'Khufu ship'],
                                ],
                            ],
                        ],
                    ],
                ], 200);
            }

            return Http::response(['query' => ['pages' => []]], 200);
        });

        $article = app(WikipediaArticleResolver::class)->find(
            'barco solar de giza',
            'Navío del Antiguo Egipto enterrado junto a la pirámide de Keops en Guiza.',
            'es',
        );

        $this->assertNotNull($article);
        $this->assertSame('https://es.wikipedia.org/wiki/Barca_funeraria_de_Keops', $article->url);
        $this->assertSame('es', $article->language);
        $this->assertSame('Khufu ship', $article->mediaPages[1]['title'] ?? null);
    }

    public function test_english_fallback_langlink_localizes_when_the_local_search_misses(): void
    {
        Http::fake(function (Request $request) {
            $params = $this->params($request);
            $host = (string) parse_url($request->url(), PHP_URL_HOST);

            if ($host === 'es.wikipedia.org' && ($params['generator'] ?? '') === 'search') {
                return Http::response(['query' => ['pages' => []]], 200);
            }

            if ($host === 'en.wikipedia.org' && ($params['generator'] ?? '') === 'search') {
                return Http::response([
                    'query' => [
                        'pages' => [
                            '1' => [
                                'title' => 'Khufu ship',
                                'index' => 1,
                                'extract' => 'The Khufu ship is an intact full-size solar barque from ancient Egypt buried at Giza.',
                            ],
                        ],
                    ],
                ], 200);
            }

            if ($host === 'en.wikipedia.org' && ($params['prop'] ?? '') === 'langlinks') {
                return Http::response([
                    'query' => [
                        'pages' => [
                            '1' => [
                                'title' => 'Khufu ship',
                                'langlinks' => [
                                    ['lang' => 'es', '*' => 'Barca funeraria de Keops'],
                                ],
                            ],
                        ],
                    ],
                ], 200);
            }

            return Http::response(['query' => ['pages' => []]], 200);
        });

        $concept = Concept::query()->create(['canonical_key' => 'giza-solar-boat']);
        ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => 'en',
            'term' => 'giza solar boat',
            'normalized_term' => 'giza solar boat',
            'short_description' => 'Ancient Egyptian wooden ship buried beside the Great Pyramid of Khufu at Giza.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);
        $spanish = ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => 'es',
            'term' => 'nombre oscuro',
            'normalized_term' => 'nombre oscuro',
            'short_description' => 'Sin coincidencias locales.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);

        $stats = app(ConceptCompleteInfoService::class)->complete([$spanish->id], 'wiki');

        $this->assertSame(1, $stats['wikiUpdated']);
        $spanish->refresh();
        $this->assertSame('https://es.wikipedia.org/wiki/Barca_funeraria_de_Keops', $spanish->wiki_url);
    }

    /**
     * @return array<string, mixed>
     */
    private function wikimediaPayload(Request $request): array
    {
        $params = $this->params($request);
        $host = (string) parse_url($request->url(), PHP_URL_HOST);
        $prop = (string) ($params['prop'] ?? '');

        if (($params['generator'] ?? '') === 'search') {
            return [
                'query' => [
                    'pages' => [
                        '10' => [
                            'title' => 'Giza Solar boat museum',
                            'index' => 2,
                            'extract' => 'The Giza Solar boat museum was dedicated to display the reconstructed Khufu ship, a solar barque of pharaoh Khufu. It was constructed between 1961 and 1982, just a few meters from where the Khufu ship was found.',
                        ],
                        '11' => [
                            'title' => 'Khufu ship',
                            'index' => 1,
                            'extract' => 'The Khufu ship is an intact full-size solar barque from ancient Egypt. It was sealed into a pit alongside the Great Pyramid of pharaoh Khufu around 2500 BC, during the Fourth Dynasty of the ancient Egyptian Old Kingdom. The ship was buried at Giza.',
                        ],
                        '12' => [
                            'title' => 'Ancient Egyptian royal ships',
                            'index' => 4,
                            'extract' => 'Several ancient Egyptian solar ships and boat pits were found in many ancient Egyptian sites. The most famous is the Khufu ship, which is now preserved in the Grand Egyptian Museum.',
                        ],
                    ],
                ],
            ];
        }

        if ($host !== 'commons.wikimedia.org' && str_contains($prop, 'images')) {
            return [
                'query' => [
                    'pages' => [
                        '4115690' => [
                            'title' => 'Khufu ship',
                            'images' => [
                                ['title' => 'File:Barque_Solaire.JPG'],
                                ['title' => 'File:Khufu ship attribution.jpg'],
                                ['title' => 'File:GEM Khufus Boat front 2025.jpg'],
                                ['title' => 'File:Galley - Layard - Ninive page 324 detail.png'],
                                ['title' => 'File:Model of Khufu solar barque.jpg'],
                                ['title' => 'File:Khufu ship tour.webm'],
                                ['title' => 'File:Commons-logo.svg'],
                            ],
                        ],
                    ],
                ],
            ];
        }

        if (str_contains($prop, 'imageinfo')) {
            return [
                'query' => [
                    'pages' => [
                        '1' => $this->imagePage(
                            'File:Barque_Solaire.JPG',
                            'https://upload.wikimedia.org/wikipedia/commons/6/6f/Barque_Solaire.JPG',
                            'image/jpeg',
                            400000,
                            'CC BY-SA 3.0',
                            'true',
                        ),
                        '2' => $this->imagePage(
                            'File:Khufu ship attribution.jpg',
                            'https://upload.wikimedia.org/wikipedia/commons/a/a1/Khufu_ship_attribution.jpg',
                            'image/jpeg',
                            400000,
                            'CC BY 4.0',
                            'true',
                        ),
                        '3' => $this->imagePage(
                            'File:GEM Khufus Boat front 2025.jpg',
                            'https://upload.wikimedia.org/wikipedia/commons/5/56/GEM_Khufus_Boat_front_2025.jpg',
                            'image/jpeg',
                            800000,
                            'CC0',
                            'false',
                        ),
                        '4' => $this->imagePage(
                            'File:Galley - Layard - Ninive page 324 detail.png',
                            'https://upload.wikimedia.org/wikipedia/commons/2/2f/Galley_-_Layard_-_Ninive_page_324_detail.png',
                            'image/png',
                            200000,
                            'Public domain',
                            'false',
                        ),
                        '5' => $this->imagePage(
                            'File:Model of Khufu solar barque.jpg',
                            'https://upload.wikimedia.org/wikipedia/commons/b/bb/Model_of_Khufu_solar_barque.jpg',
                            'image/jpeg',
                            300000,
                            'Public domain',
                            'false',
                        ),
                        '6' => [
                            'title' => 'File:Khufu ship tour.webm',
                            'imageinfo' => [[
                                'url' => 'https://upload.wikimedia.org/wikipedia/commons/1/11/Khufu_ship_tour.webm',
                                'mime' => 'video/webm',
                                'size' => 2_000_000,
                                'extmetadata' => [
                                    'LicenseShortName' => ['value' => 'Public domain'],
                                    'UsageTerms' => ['value' => 'Public domain'],
                                    'AttributionRequired' => ['value' => 'false'],
                                ],
                            ]],
                        ],
                    ],
                ],
            ];
        }

        return ['query' => ['pages' => []]];
    }

    /**
     * @return array<string, mixed>
     */
    private function imagePage(string $title, string $original, string $mime, int $size, string $license, string $attribution): array
    {
        $path = (string) parse_url($original, PHP_URL_PATH);
        $thumb = 'https://thumb.wikimedia.org/wikipedia/commons/thumb'.preg_replace('#^/wikipedia/commons/#', '/', $path).'/1280px-'.basename($path);

        return [
            'title' => $title,
            'imageinfo' => [[
                'url' => $original.'?utm_source=commons',
                'thumburl' => $thumb,
                'mime' => $mime,
                'size' => $size,
                'extmetadata' => [
                    'LicenseShortName' => ['value' => $license],
                    'UsageTerms' => ['value' => $license],
                    'AttributionRequired' => ['value' => $attribution],
                    'Restrictions' => ['value' => ''],
                ],
            ]],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function params(Request $request): array
    {
        $data = $request->data();
        if (is_array($data) && isset($data['action'])) {
            return $data;
        }

        $query = parse_url($request->url(), PHP_URL_QUERY);
        parse_str(is_string($query) ? $query : '', $parsed);

        return $parsed;
    }

    private function makeTerm(string $term, string $description): ConceptTerm
    {
        $concept = Concept::query()->create([
            'canonical_key' => Str::slug($term).'-'.Str::random(4),
        ]);

        return ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => 'en',
            'term' => $term,
            'normalized_term' => ConceptTerm::normalizeTerm($term),
            'short_description' => $description,
            'wiki_url' => null,
            'media_url' => null,
            'complexity' => 2,
            'is_preferred' => true,
        ]);
    }
}
