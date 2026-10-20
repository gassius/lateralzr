<?php

namespace App\Services\ConceptPipeline;

use App\Ai\Support\AiProviders;
use App\Jobs\CompleteInfoPipelineNodeJob;
use App\Jobs\GeneratePipelineNodeJob;
use App\Jobs\LocalizePipelineNodeJob;
use App\Models\Concept;
use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
use App\Models\ConceptTerm;
use App\Support\ConceptLocale;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class ConceptPipelineDispatchService
{
    public const MAX_DEPTH = 3;

    public const MAX_CONCEPTS = 200;

    public const DEFAULT_COUNT = 10;

    public const DEFAULT_COMPLEXITY = 3;

    public const DEFAULT_DEPTH = 1;

    public const MAX_LABEL_LENGTH = 255;

    /**
     * @param  list<string>  $concepts
     * @param  list<string>|null  $locales
     */
    public function dispatch(
        array $concepts = [],
        int $random = 0,
        int $count = self::DEFAULT_COUNT,
        int $complexity = self::DEFAULT_COMPLEXITY,
        int $depth = self::DEFAULT_DEPTH,
        ?array $locales = null,
        ?string $provider = null,
        ?string $model = null,
        string $queue = 'default',
    ): ConceptGraphRun {
        $depth = (int) $depth;
        if ($depth < 1 || $depth > self::MAX_DEPTH) {
            throw new InvalidArgumentException('Depth must be between 1 and 3.');
        }

        $count = max(1, min(100, $count));
        $complexity = max(1, min(5, $complexity));
        $random = max(0, $random);
        $queue = $queue !== '' ? $queue : 'default';

        $provider = AiProviders::normalize($provider);
        $model = $model !== null && $model !== '' ? $model : AiProviders::defaultTextModel($provider);

        $locales = $this->resolveLocales($locales);
        $starts = $this->resolveStarts($concepts, $random);

        if ($starts === []) {
            throw new InvalidArgumentException('Provide --concept, --concepts, or --random.');
        }

        if (count($starts) > self::MAX_CONCEPTS) {
            $starts = array_slice($starts, 0, self::MAX_CONCEPTS);
        }

        $runUuid = (string) Str::uuid();
        $seedLabels = array_column($starts, 'seed_term');

        $run = ConceptGraphRun::query()->create([
            'run_uuid' => $runUuid,
            'type' => ConceptGraphRun::TYPE_PIPELINE,
            'provider' => $provider,
            'model' => $model,
            'complexity' => $complexity,
            'queue' => $queue,
            'seed_count' => count($starts),
            'seeds' => [
                'starts' => $seedLabels,
                'count' => $count,
                'depth' => $depth,
                'locales' => $locales,
                'random' => $random,
                'targetCount' => $count,
                'maxConcepts' => self::MAX_CONCEPTS,
                'conceptsCreated' => 0,
                'conceptsReserved' => 0,
            ],
            'related_count' => min(255, $count),
            'dispatched_at' => now(),
        ]);

        $nodes = [];
        foreach ($starts as $start) {
            $nodes[] = ConceptPipelineNode::query()->create([
                'run_uuid' => $runUuid,
                'parent_node_id' => null,
                'concept_id' => $start['concept_id'],
                'canonical_key' => $start['canonical_key'],
                'seed_term' => $start['seed_term'],
                'depth' => 0,
                'generate_status' => ConceptPipelineNode::STATUS_PENDING,
                'localize_status' => ConceptPipelineNode::STATUS_PENDING,
                'complete_info_status' => ConceptPipelineNode::STATUS_PENDING,
            ]);
        }

        foreach ($nodes as $node) {
            $this->enqueueNodeChain($node, $queue);
        }

        return $run;
    }

    public function enqueueNodeChain(ConceptPipelineNode $node, string $queue): void
    {
        $jobs = [new GeneratePipelineNodeJob($node->id)];

        $run = $node->run;
        $locales = $run instanceof ConceptGraphRun ? $this->targetLocales($run) : [];
        if ($locales === []) {
            $jobs[] = new LocalizePipelineNodeJob($node->id, '');
        } else {
            foreach ($locales as $locale) {
                $jobs[] = new LocalizePipelineNodeJob($node->id, $locale);
            }
        }

        $jobs[] = new CompleteInfoPipelineNodeJob($node->id);

        Bus::chain($jobs)->onQueue($queue)->dispatch();
    }

    /**
     * Locales this run will translate into (supported targets, excluding the default locale).
     *
     * @return list<string>
     */
    public function targetLocales(ConceptGraphRun $run): array
    {
        $locales = data_get($run->seeds, 'locales', []);
        $locales = is_array($locales) ? array_values(array_filter($locales, 'is_string')) : [];
        $fromLocale = ConceptLocale::default();

        return array_values(array_filter(
            $locales,
            fn (string $locale): bool => $locale !== $fromLocale
        ));
    }

    /**
     * Re-queue a failed stage on one node. Later skipped/pending stages are
     * reset and chained so the rest of the node can continue; succeeded
     * earlier stages are left alone.
     */
    public function retryStage(ConceptPipelineNode $node, string $stage): void
    {
        $stageIndex = array_search($stage, ConceptPipelineNode::STAGES, true);
        if ($stageIndex === false) {
            throw new InvalidArgumentException("Unknown pipeline stage [{$stage}].");
        }

        $payload = DB::transaction(function () use ($node, $stage, $stageIndex): array {
            $locked = ConceptPipelineNode::query()
                ->lockForUpdate()
                ->findOrFail($node->id);

            if ($locked->statusFor($stage) !== ConceptPipelineNode::STATUS_FAILED) {
                throw new InvalidArgumentException('Only failed pipeline stages can be retried.');
            }

            $run = $locked->run;
            if (! $run instanceof ConceptGraphRun) {
                throw new InvalidArgumentException('Pipeline run missing for this node.');
            }

            $jobs = [];

            foreach (ConceptPipelineNode::STAGES as $index => $candidate) {
                if ($index < $stageIndex) {
                    continue;
                }

                $status = $locked->statusFor($candidate);

                if ($index > $stageIndex && ! in_array($status, [
                    ConceptPipelineNode::STATUS_SKIPPED,
                    ConceptPipelineNode::STATUS_PENDING,
                ], true)) {
                    break;
                }

                $locked->resetStage($candidate);
                $jobs[] = $this->jobForStage($locked, $candidate);
            }

            return [
                'jobs' => $jobs,
                'queue' => (string) ($run->queue ?: 'default'),
            ];
        });

        if ($payload['jobs'] === []) {
            return;
        }

        Bus::chain($payload['jobs'])->onQueue($payload['queue'])->dispatch();
    }

    protected function jobForStage(ConceptPipelineNode $node, string $stage): GeneratePipelineNodeJob|LocalizePipelineNodeJob|CompleteInfoPipelineNodeJob
    {
        return match ($stage) {
            ConceptPipelineNode::STAGE_GENERATE => new GeneratePipelineNodeJob($node->id),
            ConceptPipelineNode::STAGE_LOCALIZE => new LocalizePipelineNodeJob($node->id),
            ConceptPipelineNode::STAGE_COMPLETE_INFO => new CompleteInfoPipelineNodeJob($node->id),
            default => throw new InvalidArgumentException("Unknown pipeline stage [{$stage}]."),
        };
    }

    /**
     * Persist child nodes for newly generated concepts and enqueue their chains.
     *
     * @param  array<string, Concept>  $resolved
     * @return list<ConceptPipelineNode>
     */
    public function enqueueChildren(ConceptPipelineNode $parent, array $resolved): array
    {
        $run = $parent->run;
        if (! $run instanceof ConceptGraphRun) {
            return [];
        }

        $maxDepth = (int) data_get($run->seeds, 'depth', self::DEFAULT_DEPTH);
        $queue = (string) ($run->queue ?: 'default');
        $childDepth = $parent->depth + 1;

        if ($childDepth > $maxDepth || $childDepth > self::MAX_DEPTH) {
            return [];
        }

        $created = [];

        DB::transaction(function () use ($parent, $resolved, $childDepth, &$created): void {
            ConceptGraphRun::query()
                ->where('run_uuid', $parent->run_uuid)
                ->lockForUpdate()
                ->first();

            $existingKeys = ConceptPipelineNode::query()
                ->where('run_uuid', $parent->run_uuid)
                ->pluck('canonical_key')
                ->all();
            $existingSet = array_fill_keys($existingKeys, true);
            $used = count($existingKeys);

            foreach ($resolved as $canonicalKey => $concept) {
                if ($canonicalKey === $parent->canonical_key) {
                    continue;
                }

                if ($parent->concept_id !== null && (int) $concept->id === (int) $parent->concept_id) {
                    continue;
                }

                if (isset($existingSet[$canonicalKey])) {
                    continue;
                }

                if ($used >= self::MAX_CONCEPTS) {
                    break;
                }

                try {
                    $node = ConceptPipelineNode::query()->create([
                        'run_uuid' => $parent->run_uuid,
                        'parent_node_id' => $parent->id,
                        'concept_id' => $concept->id,
                        'canonical_key' => $canonicalKey,
                        'seed_term' => $concept->preferredTerm?->term ?? $canonicalKey,
                        'depth' => $childDepth,
                        'generate_status' => ConceptPipelineNode::STATUS_PENDING,
                        'localize_status' => ConceptPipelineNode::STATUS_PENDING,
                        'complete_info_status' => ConceptPipelineNode::STATUS_PENDING,
                    ]);
                } catch (UniqueConstraintViolationException) {
                    continue;
                }

                $existingSet[$canonicalKey] = true;
                $used++;
                $created[] = $node;
            }
        });

        foreach ($created as $node) {
            $this->enqueueNodeChain($node, $queue);
        }

        return $created;
    }

    /**
     * Reserve up to $want new-concept slots for this run. Returns how many may be created.
     */
    public function reserveConceptBudget(ConceptGraphRun $run, int $want): int
    {
        $want = max(0, $want);
        $allowed = 0;

        DB::transaction(function () use ($run, $want, &$allowed): void {
            $locked = ConceptGraphRun::query()->whereKey($run->id)->lockForUpdate()->first();
            if (! $locked instanceof ConceptGraphRun) {
                return;
            }

            $seeds = is_array($locked->seeds) ? $locked->seeds : [];
            $max = (int) ($seeds['maxConcepts'] ?? self::MAX_CONCEPTS);
            $created = (int) ($seeds['conceptsCreated'] ?? 0);
            $reserved = (int) ($seeds['conceptsReserved'] ?? 0);
            $remaining = max(0, $max - $created - $reserved);
            $allowed = min($want, $remaining);
            $seeds['maxConcepts'] = $max;
            $seeds['conceptsCreated'] = $created;
            $seeds['conceptsReserved'] = $reserved + $allowed;
            $locked->seeds = $seeds;
            $locked->save();
        });

        return $allowed;
    }

    public function settleConceptBudget(ConceptGraphRun $run, int $reserved, int $created): void
    {
        DB::transaction(function () use ($run, $reserved, $created): void {
            $locked = ConceptGraphRun::query()->whereKey($run->id)->lockForUpdate()->first();
            if (! $locked instanceof ConceptGraphRun) {
                return;
            }

            $seeds = is_array($locked->seeds) ? $locked->seeds : [];
            $seeds['conceptsReserved'] = max(0, (int) ($seeds['conceptsReserved'] ?? 0) - max(0, $reserved));
            $seeds['conceptsCreated'] = (int) ($seeds['conceptsCreated'] ?? 0) + max(0, $created);
            $locked->seeds = $seeds;
            $locked->save();
        });
    }

    /**
     * Keep the seed and existing related concepts for edge linking. Count only
     * newly created concepts against $allowedNew; extra new labels are dropped.
     *
     * @param  list<array<string, mixed>>  $concepts
     * @return array{0: list<array<string, mixed>>, 1: int}
     */
    public function limitNewConcepts(array $concepts, string $seedKey, int $allowedNew): array
    {
        $allowedNew = max(0, $allowedNew);
        $kept = [];
        $seen = [];
        $newCount = 0;

        foreach ($concepts as $concept) {
            if (! is_array($concept)) {
                continue;
            }

            $key = ConceptTerm::normalizeTerm((string) ($concept['concept'] ?? ''));
            if ($key === '' || isset($seen[$key])) {
                continue;
            }

            $exists = $this->conceptAlreadyExists($key);
            $isSeed = $key === $seedKey;

            if ($isSeed) {
                $kept[] = $concept;
                $seen[$key] = true;
                if (! $exists) {
                    $newCount++;
                }

                continue;
            }

            if ($exists) {
                $kept[] = $concept;
                $seen[$key] = true;

                continue;
            }

            if ($newCount >= $allowedNew) {
                continue;
            }

            $kept[] = $concept;
            $seen[$key] = true;
            $newCount++;
        }

        return [$kept, $newCount];
    }

    public function conceptAlreadyExists(string $canonicalKey): bool
    {
        if (Concept::query()->where('canonical_key', $canonicalKey)->exists()) {
            return true;
        }

        return ConceptTerm::query()->where('normalized_term', $canonicalKey)->exists();
    }

    /**
     * @param  list<string>  $concepts
     * @return list<array{seed_term: string, canonical_key: string, concept_id: int|null}>
     */
    public function resolveStarts(array $concepts, int $random): array
    {
        $starts = [];
        $seen = [];

        foreach ($concepts as $raw) {
            $label = trim((string) $raw);
            if ($label === '') {
                continue;
            }

            if (mb_strlen($label) > self::MAX_LABEL_LENGTH) {
                throw new InvalidArgumentException(
                    'Starting concept labels must be at most '.self::MAX_LABEL_LENGTH.' characters.'
                );
            }

            $canonical = ConceptTerm::normalizeTerm($label);
            if ($canonical === '' || isset($seen[$canonical])) {
                continue;
            }

            $seen[$canonical] = true;
            $starts[] = $this->startFromLabel($label, $canonical);
        }

        if ($random > 0) {
            $existing = Concept::query()
                ->with('preferredTerm')
                ->inRandomOrder()
                ->limit($random)
                ->get();

            foreach ($existing as $concept) {
                $label = $concept->preferredTerm?->term ?? (string) $concept->canonical_key;
                $canonical = ConceptTerm::normalizeTerm($label);
                if ($canonical === '' || isset($seen[$canonical])) {
                    continue;
                }

                $seen[$canonical] = true;
                $starts[] = [
                    'seed_term' => $label,
                    'canonical_key' => (string) $concept->canonical_key,
                    'concept_id' => (int) $concept->id,
                ];
            }

            if ($starts === []) {
                throw new InvalidArgumentException('No existing concepts available for --random.');
            }
        }

        return $starts;
    }

    /**
     * @param  list<string>|null  $locales
     * @return list<string>
     */
    public function resolveLocales(?array $locales): array
    {
        $supported = ConceptLocale::supported();

        if ($locales === null) {
            return array_values(array_filter(
                $supported,
                fn (string $locale): bool => $locale !== ConceptLocale::default()
            ));
        }

        $resolved = [];
        foreach ($locales as $raw) {
            $normalized = strtolower(trim((string) $raw));
            if ($normalized === '') {
                continue;
            }

            $primary = explode('-', $normalized, 2)[0];
            if (! in_array($normalized, $supported, true) && ! in_array($primary, $supported, true)) {
                throw new InvalidArgumentException(
                    'Locale must be in supported list: '.implode(', ', $supported)
                );
            }

            $locale = ConceptLocale::resolve($normalized);
            if ($locale === ConceptLocale::default()) {
                continue;
            }

            $resolved[] = $locale;
        }

        return array_values(array_unique($resolved));
    }

    /**
     * @return array{seed_term: string, canonical_key: string, concept_id: int|null}
     */
    protected function startFromLabel(string $label, string $canonical): array
    {
        $term = ConceptTerm::query()
            ->with('concept')
            ->where('normalized_term', $canonical)
            ->orderByDesc('is_preferred')
            ->first();

        return [
            'seed_term' => $label,
            'canonical_key' => $term?->concept?->canonical_key ?? $canonical,
            'concept_id' => $term?->concept_id,
        ];
    }
}
