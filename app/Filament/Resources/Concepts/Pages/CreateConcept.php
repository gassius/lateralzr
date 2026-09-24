<?php

namespace App\Filament\Resources\Concepts\Pages;

use App\Filament\Resources\Concepts\ConceptResource;
use App\Models\ConceptTerm;
use Filament\Resources\Pages\CreateRecord;

class CreateConcept extends CreateRecord
{
    protected static string $resource = ConceptResource::class;

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        // Relationship repeater (`terms`) is persisted separately.
        unset($data['terms']);

        return $data;
    }

    protected function afterCreate(): void
    {
        ConceptTerm::applyPersistedDefaults($this->record->terms());
    }
}
