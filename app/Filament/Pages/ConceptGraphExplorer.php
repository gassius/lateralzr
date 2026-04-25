<?php

namespace App\Filament\Pages;

use App\Filament\Resources\Concepts\ConceptResource;
use App\Models\Concept;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
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

    public int $complexity = 2;

    public ?string $relationshipType = null;

    public float $minStrength = 0.0;

    public int $limit = 60;

    /** @var array<int, array<string, mixed>> */
    public array $graphElements = [];

    public ?int $selectedRelationshipId = null;

    /** @var array{relationship_type?: string, strength?: float|int|string, user_weight?: int|string} */
    public array $edgeForm = [];

    public function mount(): void
    {
        $this->complexity = (int) config('concepts.default_complexity', 2);
        $this->minStrength = 0.0;
        $this->limit = 60;

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

        $conceptId = $this->resolveConceptId($seed);
        if (! $conceptId) {
            $this->graphElements = [];
            $this->selectedRelationshipId = null;

            return;
        }

        $seedConcept = Concept::query()
            ->with('preferredTerm')
            ->find($conceptId);

        $query = ConceptRelationship::query()
            ->where('complexity', $this->complexity)
            ->where('strength', '>=', $this->minStrength)
            ->where(function (Builder $q) use ($conceptId) {
                $q->where('from_concept_id', $conceptId)
                    ->orWhere('to_concept_id', $conceptId);
            });

        if ($this->relationshipType) {
            $query->where('relationship_type', $this->relationshipType);
        }

        $edges = $query
            ->with(['fromConcept.preferredTerm', 'toConcept.preferredTerm'])
            ->orderByDesc('strength')
            ->limit(max(1, $this->limit))
            ->get();

        $nodes = [];
        $elements = [];

        // Always include the seed node, even if it has no qualifying edges.
        if ($seedConcept) {
            $nodes[$seedConcept->id] = [
                'data' => [
                    'id' => 'c'.$seedConcept->id,
                    'concept_id' => $seedConcept->id,
                    'label' => $seedConcept->display_term ?? ('concept#'.$seedConcept->id),
                ],
            ];
        }

        foreach ($edges as $edge) {
            $from = $edge->fromConcept;
            $to = $edge->toConcept;

            if ($from) {
                $nodes[$from->id] = [
                    'data' => [
                        'id' => 'c'.$from->id,
                        'concept_id' => $from->id,
                        'label' => $from->display_term ?? ('concept#'.$from->id),
                    ],
                ];
            }
            if ($to) {
                $nodes[$to->id] = [
                    'data' => [
                        'id' => 'c'.$to->id,
                        'concept_id' => $to->id,
                        'label' => $to->display_term ?? ('concept#'.$to->id),
                    ],
                ];
            }

            $elements[] = [
                'data' => [
                    'id' => 'r'.$edge->id,
                    'relationship_id' => $edge->id,
                    'source' => 'c'.$edge->from_concept_id,
                    'target' => 'c'.$edge->to_concept_id,
                    'label' => $edge->relationship_type.' • '.number_format((float) $edge->strength, 3),
                    'strength' => (float) $edge->strength,
                    'relationship_type' => $edge->relationship_type,
                    'user_weight' => (int) $edge->user_weight,
                ],
            ];
        }

        $this->graphElements = array_values($nodes);
        $this->graphElements = array_merge($this->graphElements, $elements);

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
            'relationship_type' => $rel->relationship_type,
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
            'relationship_type' => (string) ($this->edgeForm['relationship_type'] ?? $rel->relationship_type),
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
            ->where('complexity', $this->complexity)
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

