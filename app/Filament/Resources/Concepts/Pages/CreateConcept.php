<?php

namespace App\Filament\Resources\Concepts\Pages;

use App\Filament\Resources\Concepts\ConceptResource;
use App\Models\Concept;
use App\Models\ConceptTerm;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Database\Eloquent\Model;

class CreateConcept extends CreateRecord
{
    protected static string $resource = ConceptResource::class;

    protected function handleRecordCreation(array $data): Model
    {
        $locale = (string) config('concepts.default_locale', 'en');

        $concept = Concept::query()->create([
            'canonical_key' => $data['canonical_key'],
        ]);

        ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => $locale,
            'term' => $data['term'],
            'normalized_term' => ConceptTerm::normalizeTerm($data['term']),
            'short_description' => $data['short_description'] ?? null,
            'complexity' => max(1, min(5, (int) ($data['complexity'] ?? config('concepts.default_complexity', 2)))),
            'wiki_url' => $data['wiki_url'] ?? null,
            'media_url' => $data['media_url'] ?? null,
            'is_preferred' => true,
        ]);

        return $concept;
    }
}
