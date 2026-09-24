<?php

namespace App\Filament\Resources\Concepts\Pages;

use App\Filament\Resources\Concepts\ConceptResource;
use App\Models\ConceptTerm;
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
        ConceptTerm::applyPersistedDefaults($this->record->terms());
    }

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
