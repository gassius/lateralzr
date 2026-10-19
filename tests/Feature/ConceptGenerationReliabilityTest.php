<?php

namespace Tests\Feature;

use App\Ai\Agents\ConceptsOnlyAgent;
use App\Ai\Support\AiConfigOverride;
use App\Ai\Support\AiProviders;
use App\Filament\Resources\ConceptGraphRuns\Pages\ListConceptGraphRuns;
use App\Jobs\LocalizeConceptBatchJob;
use App\Models\Concept;
use App\Models\ConceptGraphRun;
use App\Models\ConceptGraphRunJob;
use App\Models\ConceptMedia;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Services\ConceptCanonicalizer;
use App\Services\ConceptCompleteInfoService;
use App\Services\ConceptGraphStore;
use App\Services\ConceptLocalizeService;
use App\Services\Enrichment\QualifiedMedia;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Ai\Responses\StructuredAgentResponse;
use Tests\TestCase;

class ConceptGenerationReliabilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_agent_model_returns_override_not_env_default(): void
    {
        config([
            'ai.default' => 'ollama',
            'ai.models.text' => 'llama3.2:3b',
        ]);

        AiConfigOverride::run('openrouter', 'openai/gpt-4o-mini', function (): void {
            $this->assertSame(\Laravel\Ai\Enums\Lab::OpenRouter, (new ConceptsOnlyAgent)->provider());
            $this->assertSame('openai/gpt-4o-mini', (new ConceptsOnlyAgent)->model());
            $this->assertSame('openai/gpt-4o-mini', AiProviders::effectiveTextModel('openrouter'));
        });
    }

    public function test_admin_model_helper_shows_effective_default(): void
    {
        $this->assertSame(
            'Empty uses '.AiProviders::defaultTextModel('openrouter').'.',
            ListConceptGraphRuns::modelFieldHelper('openrouter')
        );
        $this->assertStringContainsString('openai/gpt-4o-mini', ListConceptGraphRuns::modelFieldHelper('openrouter'));
    }

    public function test_concurrent_edge_insert_does_not_throw(): void
    {
        $from = Concept::query()->create(['canonical_key' => 'ball']);
        $to = Concept::query()->create(['canonical_key' => 'algorithm']);
        $store = app(ConceptGraphStore::class);

        $first = $store->upsertEdge($from, $to, 0.5);
        $second = $store->upsertEdge($from, $to, 0.75);

        $this->assertSame($first->id, $second->id);
        $this->assertSame(2, (int) $second->llm_occurrences);
        $this->assertEqualsWithDelta(0.75, (float) $second->last_laterality, 0.001);
        $this->assertSame(1, ConceptRelationship::query()->where('from_concept_id', $from->id)->where('to_concept_id', $to->id)->count());
    }

    public function test_canonical_race_attaches_term_when_concept_exists_first(): void
    {
        $concept = Concept::query()->create(['canonical_key' => 'origami']);

        $resolved = app(ConceptCanonicalizer::class)->resolveOrCreate(
            term: 'origami',
            locale: 'en',
            shortDescription: 'Folded paper.',
            complexity: 3
        );

        $this->assertSame($concept->id, $resolved->id);
        $this->assertSame(1, ConceptTerm::query()->where('locale', 'en')->where('normalized_term', 'origami')->count());
        $term = ConceptTerm::query()->where('concept_id', $concept->id)->where('locale', 'en')->first();
        $this->assertSame('Folded paper.', $term?->short_description);
    }

    public function test_localize_locale_norm_collision_is_skipped(): void
    {
        $owner = Concept::query()->create(['canonical_key' => 'traffic-light']);
        $other = Concept::query()->create(['canonical_key' => 'semaphore']);
        ConceptTerm::query()->create([
            'concept_id' => $owner->id,
            'locale' => 'en',
            'term' => 'traffic light',
            'normalized_term' => 'traffic light',
            'short_description' => 'A road signal.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);
        ConceptTerm::query()->create([
            'concept_id' => $owner->id,
            'locale' => 'es',
            'term' => 'semáforo',
            'normalized_term' => 'semáforo',
            'short_description' => 'Señal de tráfico.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);
        ConceptTerm::query()->create([
            'concept_id' => $other->id,
            'locale' => 'en',
            'term' => 'semaphore',
            'normalized_term' => 'semaphore',
            'short_description' => 'A signaling system.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);

        $otherId = $other->id;
        $fakeAgent = new class($otherId)
        {
            public function __construct(private int $conceptId) {}

            public function prompt(string $prompt): StructuredAgentResponse
            {
                return new StructuredAgentResponse(
                    invocationId: 'test',
                    structured: [
                        'translations' => [[
                            'id' => $this->conceptId,
                            'term' => 'semáforo',
                            'shortDescription' => 'Sistema de señales.',
                        ]],
                    ],
                    text: '{}',
                    usage: new \Laravel\Ai\Responses\Data\Usage,
                    meta: new \Laravel\Ai\Responses\Data\Meta('test', 'test')
                );
            }
        };

        $stats = app(ConceptLocalizeService::class)->localize(
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            agent: $fakeAgent,
            conceptIds: [$other->id],
        );

        $this->assertSame(1, $stats['skipped']);
        $this->assertSame(0, $stats['failed']);
        $this->assertSame(0, $stats['created']);
        $this->assertNull($other->fresh()->termForLocale('es', fallback: false));
        $this->assertSame(1, ConceptTerm::query()->where('locale', 'es')->where('normalized_term', 'semáforo')->count());
    }

    public function test_localize_follow_up_seed_collision_does_not_fail(): void
    {
        Queue::fake();

        $runUuid = (string) Str::uuid();
        ConceptGraphRun::query()->create([
            'run_uuid' => $runUuid,
            'type' => ConceptGraphRun::TYPE_LOCALIZE,
            'complexity' => 2,
            'queue' => 'default',
            'seed_count' => 2,
            'seeds' => [
                'from' => 'en',
                'to' => 'es',
                'missingOnly' => true,
                'batchSize' => 10,
                'batches' => [
                    'localize#1' => [42, 7, 8],
                    'localize#1+1' => [7, 8],
                ],
            ],
            'related_count' => 3,
            'dispatched_at' => now(),
        ]);
        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'localize#1',
            'status' => 'pending',
            'attempts' => 0,
        ]);
        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'localize#1+1',
            'status' => 'failed',
            'attempts' => 1,
            'error_message' => 'previous collision',
        ]);

        $service = \Mockery::mock(ConceptLocalizeService::class);
        $service->shouldReceive('localize')->once()->andReturn([
            'processed' => 1,
            'created' => 1,
            'skipped' => 0,
            'failed' => 0,
            'deferred' => 2,
            'deferredConceptIds' => [7, 8],
        ]);

        $job = new LocalizeConceptBatchJob(
            conceptIds: [42, 7, 8],
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            provider: 'openrouter',
            model: 'openai/gpt-4o-mini',
            runUuid: $runUuid,
            jobKey: 'localize#1',
        );
        $job->withFakeQueueInteractions();
        $job->handle($service);

        $follow = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'localize#1+1')
            ->first();

        $this->assertSame('pending', $follow?->status);
        $this->assertSame(0, (int) $follow?->attempts);
        $this->assertNull($follow?->error_message);
        $this->assertSame('partial', ConceptGraphRunJob::query()->where('seed', 'localize#1')->value('status'));
        Queue::assertPushed(LocalizeConceptBatchJob::class, fn (LocalizeConceptBatchJob $followJob) => $followJob->jobKey === 'localize#1+1');
    }

    public function test_media_url_unique_race_is_reused(): void
    {
        $concept = Concept::query()->create(['canonical_key' => 'silence-media']);
        $url = 'https://upload.wikimedia.org/wikipedia/commons/s/silence.jpg';
        $item = new QualifiedMedia($url, 'image', 'CC0');
        $service = app(ConceptCompleteInfoService::class);

        $first = $service->rememberQualifiedMedia($concept, $item, 0);
        $second = $service->rememberQualifiedMedia($concept, $item, 1);

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, ConceptMedia::query()->where('concept_id', $concept->id)->where('url', $url)->count());
    }

    public function test_localize_follow_up_does_not_reset_processing_or_succeeded(): void
    {
        foreach (['processing', 'succeeded'] as $status) {
            Queue::fake();

            $runUuid = (string) Str::uuid();
            ConceptGraphRun::query()->create([
                'run_uuid' => $runUuid,
                'type' => ConceptGraphRun::TYPE_LOCALIZE,
                'complexity' => 2,
                'queue' => 'default',
                'seed_count' => 2,
                'seeds' => [
                    'from' => 'en',
                    'to' => 'es',
                    'missingOnly' => true,
                    'batchSize' => 10,
                    'batches' => [
                        'localize#1' => [42, 7, 8],
                        'localize#1+1' => [7, 8],
                    ],
                ],
                'related_count' => 3,
                'dispatched_at' => now(),
            ]);
            ConceptGraphRunJob::query()->create([
                'run_uuid' => $runUuid,
                'seed' => 'localize#1',
                'status' => 'pending',
                'attempts' => 0,
            ]);
            ConceptGraphRunJob::query()->create([
                'run_uuid' => $runUuid,
                'seed' => 'localize#1+1',
                'status' => $status,
                'attempts' => 2,
                'error_message' => 'keep me',
            ]);

            $service = \Mockery::mock(ConceptLocalizeService::class);
            $service->shouldReceive('localize')->once()->andReturn([
                'processed' => 1,
                'created' => 1,
                'skipped' => 0,
                'failed' => 0,
                'deferred' => 2,
                'deferredConceptIds' => [7, 8],
            ]);

            $job = new LocalizeConceptBatchJob(
                conceptIds: [42, 7, 8],
                fromLocale: 'en',
                toLocale: 'es',
                missingOnly: true,
                provider: 'openrouter',
                model: 'openai/gpt-4o-mini',
                runUuid: $runUuid,
                jobKey: 'localize#1',
            );
            $job->withFakeQueueInteractions();
            $job->handle($service);

            $follow = ConceptGraphRunJob::query()
                ->where('run_uuid', $runUuid)
                ->where('seed', 'localize#1+1')
                ->first();

            $this->assertSame($status, $follow?->status, $status);
            $this->assertSame(2, (int) $follow?->attempts, $status);
            $this->assertSame('keep me', $follow?->error_message, $status);
            Queue::assertNotPushed(
                LocalizeConceptBatchJob::class,
                fn (LocalizeConceptBatchJob $followJob) => $followJob->jobKey === 'localize#1+1'
            );
        }
    }
}
