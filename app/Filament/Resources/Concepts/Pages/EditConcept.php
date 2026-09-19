<?php

namespace App\Filament\Resources\Concepts\Pages;

use App\Filament\Resources\Concepts\ConceptResource;
use App\Models\ConceptTerm;
use App\Support\ConceptLocale;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditConcept extends EditRecord
{
    protected static string $resource = ConceptResource::class;

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeSave(array $data): array
    {
        unset($data['terms']);

        return $data;
    }

    protected function afterSave(): void
    {
        $this->record->terms()->each(function (ConceptTerm $term): void {
            if ($term->locale === null || $term->locale === '') {
                $term->locale = ConceptLocale::default();
            }
            $term->normalized_term = ConceptTerm::normalizeTerm((string) $term->term);
            $term->complexity = max(1, min(5, (int) ($term->complexity ?? config('concepts.default_complexity', 2))));
            if ($term->is_preferred === null) {
                $term->is_preferred = true;
            }
            $term->save();
        });
    }

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
