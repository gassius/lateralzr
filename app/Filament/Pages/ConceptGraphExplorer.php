<?php

namespace App\Filament\Pages;

use App\Filament\Resources\Concepts\ConceptResource;
use App\Models\Concept;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Services\ConceptGraphQuery;
use Filament\Pages\Page;
use Filament\Support\Icons\Heroicon;
use Illuminate\Database\Eloquent\Builder;
use Livewire\Attributes\On;

class ConceptGraphExplorer extends Page
{
    protected static string|\UnitEnum|null $navigationGroup = 'Data';

    protected static ?string $navigationLabel = 'Concept Graph Explorer';

    protected static string|\BackedEnum|null $navigationIcon = Heroicon::OutlinedShare;

    protected string $view = 'filament.pages.concept-graph-explorer';

    public ?string $seed = null;

    public float $minStrength = 0.0;

    public int $limit = 60;

    public int $depth = 2;

    /** @var array<int, array<string, mixed>> */
    public array $graphElements = [];

    public ?int $selectedRelationshipId = null;

    /** @var array{relationship_type?: string, strength?: float|int|string, user_weight?: int|string} */
    public array $edgeForm = [];

    public function mount(): void
    {
        $this->minStrength = 0.0;
        $this->limit = 60;
        $this->depth = 2;

        if (! filled($this->seed)) {
            $this->seed = $this->defaultSeedWithEdges() ?? $this->defaultSeed();
        }

        if (filled($this->seed)) {
            $this->loadGraph();
        }

        // If the chosen seed has no edges, pick a better default.
        if (filled($this->seed) && count($this->graphElements) === 0) {
            $fallback = $this->defaultSeedWithEdges();
            if (filled($fallback) && $fallback !== $this->seed) {
                $this->seed = $fallback;
                $this->loadGraph();
            }
        }
    }

    public function loadGraph(): void
    {
        $seed = trim((string) $this->seed);
        if ($seed === '') {
            $this->graphElements = [];
            $this->selectedRelationshipId = null;

            return;
        }

        $graph = app(ConceptGraphQuery::class)->getGraph(
            startConcept: $seed,
            limit: $this->limit,
            depth: $this->depth,
            minStrength: $this->minStrength,
        );

        if ($graph === null) {
            $this->graphElements = [];
            $this->selectedRelationshipId = null;

            return;
        }

        $elements = [];

        foreach ($graph['nodes'] as $node) {
            $elements[] = [
                'data' => [
                    'id' => 'c'.$node['id'],
                    'concept_id' => (int) $node['id'],
                    'label' => $node['label'] ?: ('concept#'.$node['id']),
                    'shortDescription' => $node['shortDescription'] ?? '',
                    'complexity' => (int) ($node['complexity'] ?? 2),
                    'wikiUrl' => $node['wikiUrl'] ?? null,
                    'mediaUrl' => $node['mediaUrl'] ?? null,
                    'degree' => (int) ($node['degree'] ?? 0),
                ],
            ];
        }

        foreach ($graph['edges'] as $edge) {
            $elements[] = [
                'data' => [
                    'id' => 'r'.$edge['id'],
                    'relationship_id' => (int) $edge['id'],
                    'source' => 'c'.$edge['from'],
                    'target' => 'c'.$edge['to'],
                    'label' => number_format((float) $edge['strength'], 3).' / L'.$edge['laterality'],
                    'strength' => (float) $edge['strength'],
                    'laterality' => (int) $edge['laterality'],
                ],
            ];
        }

        $this->graphElements = $elements;

        $this->dispatch('concept-graph-updated', elements: $this->graphElements);
    }

    #[On('selectRelationship')]
    public function selectRelationship(int $relationshipId): void
    {
        $rel = ConceptRelationship::query()->find($relationshipId);
        if (! $rel) {
            $this->selectedRelationshipId = null;
            $this->edgeForm = [];

            return;
        }

        $this->selectedRelationshipId = $rel->id;
        $this->edgeForm = [
            'strength' => (float) $rel->strength,
            'user_weight' => (int) $rel->user_weight,
        ];
    }

    #[On('navigateToConcept')]
    public function navigateToConcept(int $conceptId): void
    {
        $url = ConceptResource::getUrl('edit', ['record' => $conceptId]);

        $this->redirect($url, navigate: true);
    }

    #[On('setSeedFromConcept')]
    public function setSeedFromConcept(int $conceptId): void
    {
        $locale = (string) config('concepts.default_locale', 'en');

        $term = ConceptTerm::query()
            ->where('concept_id', $conceptId)
            ->where('locale', $locale)
            ->where('is_preferred', true)
            ->value('term');

        if (is_string($term) && trim($term) !== '') {
            $this->seed = trim($term);
            $this->selectedRelationshipId = null;
            $this->edgeForm = [];
            $this->loadGraph();
        }
    }

    #[On('expandConcept')]
    public function expandConcept(int $conceptId): void
    {
        $this->depth = min(5, $this->depth + 1);
        $this->setSeedFromConcept($conceptId);
    }

    public function saveEdge(): void
    {
        if (! $this->selectedRelationshipId) {
            return;
        }

        $rel = ConceptRelationship::query()->find($this->selectedRelationshipId);
        if (! $rel) {
            return;
        }

        $rel->update([
            'strength' => (float) ($this->edgeForm['strength'] ?? $rel->strength),
            'user_weight' => (int) ($this->edgeForm['user_weight'] ?? $rel->user_weight),
        ]);

        $this->loadGraph();
    }

    protected function resolveConceptId(string $seed): ?int
    {
        $seed = trim($seed);
        if ($seed === '') {
            return null;
        }

        $locale = (string) config('concepts.default_locale', 'en');

        $concept = Concept::query()
            ->whereHas('terms', function (Builder $q) use ($seed, $locale) {
                $q->where('locale', $locale)
                    ->where('normalized_term', \App\Models\ConceptTerm::normalizeTerm($seed));
            })
            ->first();

        return $concept?->id;
    }

    protected function defaultSeed(): ?string
    {
        $locale = (string) config('concepts.default_locale', 'en');

        $term = ConceptTerm::query()
            ->where('locale', $locale)
            ->where('is_preferred', true)
            ->inRandomOrder()
            ->value('term');

        if (is_string($term) && trim($term) !== '') {
            return trim($term);
        }

        $defaults = config('concepts.default_seeds', []);
        if (is_array($defaults) && count($defaults) > 0) {
            return (string) $defaults[0];
        }

        return 'creativity';
    }

    protected function defaultSeedWithEdges(): ?string
    {
        $fromConceptId = ConceptRelationship::query()
            ->where('strength', '>', 0)
            ->inRandomOrder()
            ->value('from_concept_id');

        if (! $fromConceptId) {
            return null;
        }

        $locale = (string) config('concepts.default_locale', 'en');

        $term = ConceptTerm::query()
            ->where('concept_id', (int) $fromConceptId)
            ->where('locale', $locale)
            ->where('is_preferred', true)
            ->value('term');

        return is_string($term) && trim($term) !== '' ? trim($term) : null;
    }
}
