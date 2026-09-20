<?php

namespace App\Filament\Widgets;

use App\Models\Concept;
use App\Models\ConceptGraphRunJob;
use App\Models\ConceptRelationship;
use Filament\Support\Icons\Heroicon;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class AdminStatsOverview extends StatsOverviewWidget
{
    protected static ?int $sort = -2;

    protected function getStats(): array
    {
        $failedCutoff = now()->subDay();

        return [
            Stat::make('Concepts', Concept::query()->count())
                ->icon(Heroicon::OutlinedCube),
            Stat::make('Concept Relationships', ConceptRelationship::query()->count())
                ->icon(Heroicon::OutlinedLink),
            Stat::make('Pending workers', ConceptGraphRunJob::query()->where('status', 'pending')->count())
                ->icon(Heroicon::OutlinedClock),
            Stat::make('Processing workers', ConceptGraphRunJob::query()->where('status', 'processing')->count())
                ->icon(Heroicon::OutlinedCog),
            Stat::make(
                'Workers with errors (24h)',
                ConceptGraphRunJob::query()
                    ->where('status', 'failed')
                    ->where(function ($query) use ($failedCutoff): void {
                        $query
                            ->where('finished_at', '>=', $failedCutoff)
                            ->orWhere('updated_at', '>=', $failedCutoff);
                    })
                    ->count()
            )
                ->icon(Heroicon::OutlinedExclamationTriangle)
                ->color('danger'),
        ];
    }
}
