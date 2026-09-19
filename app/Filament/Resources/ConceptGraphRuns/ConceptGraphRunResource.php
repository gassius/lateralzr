<?php

namespace App\Filament\Resources\ConceptGraphRuns;

use App\Filament\Resources\ConceptGraphRuns\Pages\ListConceptGraphRuns;
use App\Filament\Resources\ConceptGraphRuns\Pages\ViewConceptGraphRun;
use App\Filament\Resources\ConceptGraphRuns\RelationManagers\RunJobsRelationManager;
use App\Filament\Resources\ConceptGraphRuns\Tables\ConceptGraphRunsTable;
use App\Models\ConceptGraphRun;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class ConceptGraphRunResource extends Resource
{
    protected static ?string $model = ConceptGraphRun::class;

    protected static string|\UnitEnum|null $navigationGroup = 'Data';

    protected static ?string $modelLabel = 'Concept Worker Run';

    protected static ?string $pluralModelLabel = 'Concept Worker Runs';

    protected static ?string $navigationLabel = 'Worker Runs';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return $schema;
    }

    public static function table(Table $table): Table
    {
        return ConceptGraphRunsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            RunJobsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListConceptGraphRuns::route('/'),
            'view' => ViewConceptGraphRun::route('/{record}'),
        ];
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->withCount([
                'jobs as pending_jobs_count' => fn (Builder $q) => $q->where('status', 'pending'),
                'jobs as processing_jobs_count' => fn (Builder $q) => $q->where('status', 'processing'),
                'jobs as succeeded_jobs_count' => fn (Builder $q) => $q->where('status', 'succeeded'),
                'jobs as failed_jobs_count' => fn (Builder $q) => $q->where('status', 'failed'),
            ]);
    }
}

