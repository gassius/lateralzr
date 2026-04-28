<?php

namespace App\Filament\Resources\Concepts\Pages;

use App\Filament\Resources\Concepts\ConceptResource;
use App\Models\ConceptTerm;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Database\Eloquent\Model;

class EditConcept extends EditRecord
{
    protected static string $resource = ConceptResource::class;

    protected function mutateFormDataBeforeFill(array $data): array
    {
        $locale = (string) config('concepts.default_locale', 'en');
        $term = $this->record->terms()
            ->where('locale', $locale)
            ->where('is_preferred', true)
            ->first();

        $data['term'] = $term?->term;
        $data['short_description'] = $term?->short_description;
        $data['complexity'] = (int) ($term?->complexity ?? config('concepts.default_complexity', 2));
        $data['wiki_url'] = $term?->wiki_url;
        $data['media_url'] = $term?->media_url;

        return $data;
    }

    protected function handleRecordUpdate(Model $record, array $data): Model
    {
        $record->update([
            'canonical_key' => $data['canonical_key'],
        ]);

        $locale = (string) config('concepts.default_locale', 'en');
        ConceptTerm::query()->updateOrCreate(
            [
                'concept_id' => $record->id,
                'locale' => $locale,
            ],
            [
                'term' => $data['term'],
                'normalized_term' => ConceptTerm::normalizeTerm($data['term']),
                'short_description' => $data['short_description'] ?? null,
                'complexity' => max(1, min(5, (int) ($data['complexity'] ?? config('concepts.default_complexity', 2)))),
                'wiki_url' => $data['wiki_url'] ?? null,
                'media_url' => $data['media_url'] ?? null,
                'is_preferred' => true,
            ]
        );

        return $record;
    }

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
