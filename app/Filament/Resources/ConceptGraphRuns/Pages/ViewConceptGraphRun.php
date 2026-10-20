<?php

namespace App\Filament\Resources\ConceptGraphRuns\Pages;

use App\Filament\Pages\GenerationProgress;
use App\Filament\Resources\ConceptGraphRuns\ConceptGraphRunResource;
use Filament\Actions\Action;
use Filament\Resources\Pages\ViewRecord;

class ViewConceptGraphRun extends ViewRecord
{
    protected static string $resource = ConceptGraphRunResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('generationProgress')
                ->label('Generation progress')
                ->url(fn (): string => GenerationProgress::getUrl(['record' => $this->getRecord()]))
                ->visible(fn (): bool => $this->getRecord()->isPipeline()),
        ];
    }
}
