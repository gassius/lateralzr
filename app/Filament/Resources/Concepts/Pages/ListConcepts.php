<?php

namespace App\Filament\Resources\Concepts\Pages;

use App\Filament\Resources\Concepts\ConceptResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListConcepts extends ListRecords
{
    protected static string $resource = ConceptResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
