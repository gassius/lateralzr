<?php

namespace Tests\Feature;

use App\Jobs\CompleteConceptInfoBatchJob;
use App\Models\Concept;
use App\Models\ConceptGraphRunJob;
use App\Models\ConceptMedia;
use App\Models\ConceptTerm;
use App\Services\ConceptCompleteInfoDispatchService;
use App\Services\ConceptCompleteInfoService;
use App\Services\Enrichment\QualifiedMedia;
use App\Services\Enrichment\QualifiedMediaFinder;
use App\Services\Enrichment\WikipediaArticle;
use App\Services\Enrichment\WikipediaArticleResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class CompleteConceptInfoTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_dispatch_selects_terms_missing_wiki_or_media(): void
    {
        Queue::fake();

        $missingBoth = $this->makeTerm('silence', locale: 'en', wiki: null, media: null);
        $missingWiki = $this->makeTerm('creativity', locale: 'en', wiki: null, media: 'https://example.com/c.jpg');
        $missingMedia = $this->makeTerm('constraint', locale: 'en', wiki: 'https://en.wikipedia.org/wiki/Constraint', media: null);
        $complete = $this->makeTerm('innovation', locale: 'en', wiki: 'https://en.wikipedia.org/wiki/Innovation', media: 'https://example.com/i.jpg');
        $otherLocale = $this->makeTerm('silencio', locale: 'es', wiki: null, media: null);

        $dispatch = app(ConceptCompleteInfoDispatchService::class);

        $bothIds = $dispatch->matchingTermIds('en', 'both', null);
        $this->assertEqualsCanonicalizing(
            [$missingBoth->id, $missingWiki->id, $missingMedia->id],
            $bothIds
        );
        $this->assertNotContains($complete->id, $bothIds);
        $this->assertNotContains($otherLocale->id, $bothIds);

        $wikiIds = $dispatch->matchingTermIds('en', 'wiki', null);
        $this->assertEqualsCanonicalizing([$missingBoth->id, $missingWiki->id], $wikiIds);

        $mediaIds = $dispatch->matchingTermIds('en', 'media', null);
        $this->assertEqualsCanonicalizing([$missingBoth->id, $missingMedia->id], $mediaIds);
    }

    public function test_command_enqueues_complete_info_batches_by_default(): void
    {
        Queue::fake();

        $term = $this->makeTerm('silence', locale: 'en', wiki: null, media: null);

        $this->artisan('concepts:complete-info', [
            '--locale' => 'en',
            '--batch-size' => 10,
        ])
            ->expectsOutputToContain('Enqueued complete-info')
            ->assertSuccessful();

        $this->assertDatabaseHas('concept_graph_runs', [
            'type' => 'complete_info',
            'seed_count' => 1,
        ]);

        Queue::assertPushed(CompleteConceptInfoBatchJob::class, function (CompleteConceptInfoBatchJob $job) use ($term) {
            return $job->mode === 'both'
                && $job->termIds === [$term->id];
        });
    }

    public function test_dispatch_skips_media_when_concept_already_has_qualified_media(): void
    {
        $term = $this->makeTerm('silence', locale: 'en', wiki: 'https://en.wikipedia.org/wiki/Silence', media: null);
        ConceptMedia::query()->create([
            'concept_id' => $term->concept_id,
            'url' => 'https://upload.wikimedia.org/wikipedia/commons/1/11/silence.webm',
            'kind' => 'clip',
            'license' => 'Public domain',
            'source' => 'wikimedia',
            'position' => 0,
        ]);

        $dispatch = app(ConceptCompleteInfoDispatchService::class);
        $this->assertNotContains($term->id, $dispatch->matchingTermIds('en', 'media', null));
        $this->assertNotContains($term->id, $dispatch->matchingTermIds('en', 'both', null));
    }

    public function test_command_rejects_conflicting_mode_flags(): void
    {
        $this->artisan('concepts:complete-info', [
            '--wiki-only' => true,
            '--media-only' => true,
        ])
            ->expectsOutputToContain('only one of --wiki-only or --media-only')
            ->assertFailed();
    }

    public function test_command_rejects_unsupported_locale(): void
    {
        $this->artisan('concepts:complete-info', ['--locale' => 'fr'])
            ->expectsOutputToContain('supported list')
            ->assertFailed();
    }

    public function test_command_sync_runs_inline_without_queue(): void
    {
        Queue::fake();

        $this->artisan('concepts:complete-info', [
            '--locale' => 'en',
            '--sync' => true,
        ])
            ->expectsOutputToContain('sync')
            ->assertSuccessful();

        Queue::assertNothingPushed();
        $this->assertDatabaseMissing('concept_graph_runs', ['type' => 'complete_info']);
    }

    public function test_service_completes_wiki_and_media_with_mocked_tools(): void
    {
        $term = $this->makeTerm('silence', locale: 'en', wiki: null, media: null);

        $articles = Mockery::mock(WikipediaArticleResolver::class);
        $articles->shouldReceive('find')
            ->once()
            ->andReturn(new WikipediaArticle(
                url: 'https://en.wikipedia.org/wiki/Silence',
                title: 'Silence',
                language: 'en',
                mediaPages: [['language' => 'en', 'title' => 'Silence']],
            ));

        $finder = Mockery::mock(QualifiedMediaFinder::class);
        $finder->shouldReceive('find')
            ->once()
            ->andReturn([
                new QualifiedMedia('https://upload.wikimedia.org/wikipedia/commons/s/silence.jpg', 'image', 'CC0'),
            ]);

        $service = new ConceptCompleteInfoService($articles, $finder);
        $stats = $service->complete([$term->id], 'both');

        $this->assertSame(1, $stats['processed']);
        $this->assertSame(1, $stats['wikiUpdated']);
        $this->assertSame(1, $stats['mediaUpdated']);

        $term->refresh();
        $this->assertSame('https://en.wikipedia.org/wiki/Silence', $term->wiki_url);
        $this->assertSame('https://upload.wikimedia.org/wikipedia/commons/s/silence.jpg', $term->media_url);
        $this->assertDatabaseHas('concept_media', [
            'concept_id' => $term->concept_id,
            'url' => 'https://upload.wikimedia.org/wikipedia/commons/s/silence.jpg',
            'kind' => 'image',
            'license' => 'CC0',
        ]);
    }

    public function test_service_wiki_only_skips_media_lookup(): void
    {
        $term = $this->makeTerm('silence', locale: 'en', wiki: null, media: null);

        $articles = Mockery::mock(WikipediaArticleResolver::class);
        $articles->shouldReceive('find')->once()->andReturn(new WikipediaArticle(
            url: 'https://en.wikipedia.org/wiki/Silence',
            title: 'Silence',
            language: 'en',
            mediaPages: [['language' => 'en', 'title' => 'Silence']],
        ));

        $finder = Mockery::mock(QualifiedMediaFinder::class);
        $finder->shouldNotReceive('find');

        $service = new ConceptCompleteInfoService($articles, $finder);
        $stats = $service->complete([$term->id], 'wiki');

        $this->assertSame(1, $stats['wikiUpdated']);
        $this->assertSame(0, $stats['mediaUpdated']);

        $term->refresh();
        $this->assertSame('https://en.wikipedia.org/wiki/Silence', $term->wiki_url);
        $this->assertNull($term->media_url);
    }

    public function test_batch_job_handle_marks_succeeded(): void
    {
        $runUuid = (string) Str::uuid();

        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'complete-info#1',
            'status' => 'pending',
            'attempts' => 0,
        ]);

        $service = Mockery::mock(ConceptCompleteInfoService::class);
        $service->shouldReceive('complete')->once()->andReturn([
            'processed' => 1,
            'wikiUpdated' => 1,
            'mediaUpdated' => 0,
            'skipped' => 0,
            'failed' => 0,
        ]);

        $job = new CompleteConceptInfoBatchJob(
            termIds: [42],
            mode: 'wiki',
            runUuid: $runUuid,
            jobKey: 'complete-info#1',
        );
        $job->withFakeQueueInteractions();
        $job->handle($service);

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'complete-info#1')
            ->first();

        $this->assertSame('succeeded', $record?->status);
    }

    public function test_batch_job_failed_callback_records_error(): void
    {
        $runUuid = (string) Str::uuid();

        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'complete-info#1',
            'status' => 'processing',
            'attempts' => 0,
            'started_at' => now()->subMinute(),
        ]);

        $job = new CompleteConceptInfoBatchJob(
            termIds: [1],
            mode: 'both',
            runUuid: $runUuid,
            jobKey: 'complete-info#1',
        );

        $job->failed(new RuntimeException('Worker timed out.'));

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'complete-info#1')
            ->first();

        $this->assertSame('failed', $record?->status);
        $this->assertStringContainsString('timed out', (string) $record?->error_message);
    }

    protected function makeTerm(
        string $term,
        string $locale,
        ?string $wiki,
        ?string $media,
    ): ConceptTerm {
        $concept = Concept::query()->create([
            'canonical_key' => $term.'-'.$locale.'-'.Str::random(6),
        ]);

        return ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => $locale,
            'term' => $term,
            'normalized_term' => ConceptTerm::normalizeTerm($term),
            'short_description' => 'Absence of sound.',
            'wiki_url' => $wiki,
            'media_url' => $media,
            'complexity' => 2,
            'is_preferred' => true,
        ]);
    }
}
