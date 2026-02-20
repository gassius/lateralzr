<?php

namespace App\Filament\Resources\Concepts\Pages;

use App\Filament\Resources\Concepts\ConceptResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditConcept extends EditRecord
{
    protected static string $resource = ConceptResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
