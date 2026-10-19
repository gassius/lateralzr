<?php

namespace Tests\Feature;

use App\Ai\Support\AiConfigOverride;
use App\Ai\Support\AiRequestContext;
use App\Jobs\GenerateConceptGraphJob;
use App\Models\Concept;
use App\Models\ConceptGraphRun;
use App\Models\ConceptGraphRunJob;
use App\Models\ConceptTerm;
use App\Services\ConceptGraphStore;
use App\Services\ConceptLocalizeService;
use App\Services\ConceptRelationshipService;
use App\Support\ConceptLocale;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class ConceptGenerationModelOverrideHttpTest extends TestCase
{
    use RefreshDatabase;

    public function test_graph_job_sends_override_model_in_openrouter_payload(): void
    {
        $this->configureOpenRouter();
        $recordedLogs = $this->captureLogMessages();

        $chosenModel = 'openai/gpt-4o-mini';
        Http::fake($this->openRouterResponder($chosenModel, $this->graphStructuredPayload()));

        $runUuid = (string) Str::uuid();
        ConceptGraphRun::query()->create([
            'run_uuid' => $runUuid,
            'type' => ConceptGraphRun::TYPE_GRAPH,
            'provider' => 'openrouter',
            'model' => $chosenModel,
            'complexity' => 3,
            'queue' => 'default',
            'seed_count' => 1,
            'seeds' => ['starts' => ['origami']],
            'dispatched_at' => now(),
        ]);
        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'origami#1',
            'status' => 'pending',
            'attempts' => 0,
        ]);

        $job = new GenerateConceptGraphJob(
            seed: 'origami',
            count: 3,
            complexity: 3,
            provider: 'openrouter',
            model: $chosenModel,
            runUuid: $runUuid,
            jobKey: 'origami#1',
        );
        $job->withFakeQueueInteractions();
        $job->handle(app(ConceptRelationshipService::class), app(ConceptGraphStore::class));

        Http::assertSent(function (Request $request) use ($chosenModel) {
            return str_contains($request->url(), 'openrouter.ai')
                && str_contains($request->url(), 'chat/completions')
                && ($request->data()['model'] ?? null) === $chosenModel;
        });

        $this->assertAiLogsRecorded($recordedLogs, $chosenModel, $runUuid, 'origami#1');
        $this->assertSame($chosenModel, ConceptGraphRun::query()->where('run_uuid', $runUuid)->value('model'));
    }

    public function test_localize_command_sends_override_model_in_openrouter_payload(): void
    {
        $this->configureOpenRouter();
        $recordedLogs = $this->captureLogMessages();

        $concept = Concept::query()->create(['canonical_key' => 'silence-http']);
        ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => ConceptLocale::default(),
            'term' => 'silence',
            'normalized_term' => 'silence',
            'short_description' => 'Absence of sound.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);

        $chosenModel = 'anthropic/claude-sonnet-4.5';
        Http::fake($this->openRouterResponder($chosenModel, [
            'translations' => [
                [
                    'id' => $concept->id,
                    'term' => 'silencio',
                    'shortDescription' => 'Ausencia de sonido.',
                ],
            ],
        ]));

        $this->artisan('concepts:localize', [
            '--from' => 'en',
            '--to' => 'es',
            '--sync' => true,
            '--provider' => 'openrouter',
            '--model' => $chosenModel,
        ])->assertSuccessful();

        Http::assertSent(function (Request $request) use ($chosenModel) {
            return str_contains($request->url(), 'openrouter.ai')
                && str_contains($request->url(), 'chat/completions')
                && ($request->data()['model'] ?? null) === $chosenModel;
        });

        $this->assertAiLogsRecorded($recordedLogs, $chosenModel);
        $this->assertNotNull($concept->fresh()->termForLocale('es', fallback: false));
    }

    public function test_localize_service_override_reaches_openrouter_payload(): void
    {
        $this->configureOpenRouter();
        $recordedLogs = $this->captureLogMessages();

        $concept = Concept::query()->create(['canonical_key' => 'harbor-http']);
        ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => ConceptLocale::default(),
            'term' => 'harbor',
            'normalized_term' => 'harbor',
            'short_description' => 'A sheltered port.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);

        $chosenModel = 'openai/gpt-4o-mini';
        Http::fake($this->openRouterResponder($chosenModel, [
            'translations' => [
                [
                    'id' => $concept->id,
                    'term' => 'puerto',
                    'shortDescription' => 'Un puerto resguardado.',
                ],
            ],
        ]));

        AiRequestContext::using('localize-run', 'localize#1', function () use ($chosenModel, $concept): void {
            AiConfigOverride::run('openrouter', $chosenModel, function () use ($concept): void {
                app(ConceptLocalizeService::class)->localize(
                    fromLocale: 'en',
                    toLocale: 'es',
                    missingOnly: true,
                    conceptIds: [$concept->id],
                );
            });
        });

        Http::assertSent(function (Request $request) use ($chosenModel) {
            return ($request->data()['model'] ?? null) === $chosenModel;
        });
        $this->assertAiLogsRecorded($recordedLogs, $chosenModel, 'localize-run', 'localize#1');
    }

    protected function configureOpenRouter(): void
    {
        config([
            'ai.default' => 'ollama',
            'ai.models.text' => 'llama3.2:3b',
            'ai.providers.openrouter.key' => 'test-openrouter-key',
        ]);
    }

    /**
     * @return \ArrayObject<int, MessageLogged>
     */
    protected function captureLogMessages(): \ArrayObject
    {
        $recorded = new \ArrayObject;
        Event::listen(MessageLogged::class, function (MessageLogged $event) use ($recorded): void {
            $recorded[] = $event;
        });

        return $recorded;
    }

    /**
     * @param  \ArrayObject<int, MessageLogged>  $recorded
     */
    protected function assertAiLogsRecorded(
        \ArrayObject $recorded,
        string $model,
        ?string $runUuid = null,
        ?string $jobKey = null
    ): void {
        $request = collect($recorded->getArrayCopy())->first(
            fn (MessageLogged $event) => $event->message === 'AI request'
        );
        $response = collect($recorded->getArrayCopy())->first(
            fn (MessageLogged $event) => $event->message === 'AI response'
        );

        $this->assertNotNull($request, 'Expected an AI request log entry.');
        $this->assertNotNull($response, 'Expected an AI response log entry.');
        $this->assertSame('info', $request->level);
        $this->assertSame('openrouter', $request->context['provider'] ?? null);
        $this->assertSame($model, $request->context['model'] ?? null);
        $this->assertSame('openrouter', $response->context['provider'] ?? null);
        $this->assertSame($model, $response->context['model'] ?? null);
        $this->assertSame(11, $response->context['usage']['prompt'] ?? null);
        $this->assertSame(7, $response->context['usage']['completion'] ?? null);
        $this->assertSame(18, $response->context['usage']['total'] ?? null);

        if ($runUuid !== null) {
            $this->assertSame($runUuid, $request->context['run_uuid'] ?? null);
            $this->assertSame($runUuid, $response->context['run_uuid'] ?? null);
        }
        if ($jobKey !== null) {
            $this->assertSame($jobKey, $request->context['job_key'] ?? null);
            $this->assertSame($jobKey, $response->context['job_key'] ?? null);
        }
    }

    /**
     * @param  array<string, mixed>  $structured
     */
    protected function openRouterResponder(string $expectedModel, array $structured): callable
    {
        return function (Request $request) use ($expectedModel, $structured) {
            $this->assertStringContainsString('openrouter.ai', $request->url());
            $this->assertSame($expectedModel, $request->data()['model'] ?? null);

            return Http::response([
                'id' => 'gen-test',
                'model' => $expectedModel,
                'choices' => [[
                    'finish_reason' => 'stop',
                    'message' => [
                        'role' => 'assistant',
                        'content' => json_encode($structured, JSON_THROW_ON_ERROR),
                    ],
                ]],
                'usage' => [
                    'prompt_tokens' => 11,
                    'completion_tokens' => 7,
                    'total_tokens' => 18,
                ],
            ], 200);
        };
    }

    /**
     * @return array<string, mixed>
     */
    protected function graphStructuredPayload(): array
    {
        return [
            'start_concept' => 'origami',
            'concepts' => [
                [
                    'concept' => 'origami',
                    'shortDescription' => 'The art of folding paper.',
                    'complexity' => 3,
                    'wikiUrl' => null,
                    'mediaUrl' => null,
                ],
                [
                    'concept' => 'crumple zones',
                    'shortDescription' => 'Structures that absorb crash energy.',
                    'complexity' => 3,
                    'wikiUrl' => null,
                    'mediaUrl' => null,
                ],
                [
                    'concept' => 'pufferfish',
                    'shortDescription' => 'A fish that inflates when threatened.',
                    'complexity' => 3,
                    'wikiUrl' => null,
                    'mediaUrl' => null,
                ],
            ],
            'edges' => [
                ['from' => 'origami', 'to' => 'crumple zones', 'laterality' => 4],
                ['from' => 'origami', 'to' => 'pufferfish', 'laterality' => 5],
                ['from' => 'crumple zones', 'to' => 'pufferfish', 'laterality' => 4],
            ],
        ];
    }
}
