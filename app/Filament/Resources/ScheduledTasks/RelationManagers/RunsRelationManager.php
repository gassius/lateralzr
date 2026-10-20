<?php

namespace App\Filament\Resources\ScheduledTasks\RelationManagers;

use App\Models\ConceptGraphRun;
use App\Models\ScheduledTaskRun;
use Filament\Actions\Action;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class RunsRelationManager extends RelationManager
{
    protected static string $relationship = 'runs';

    protected static ?string $title = 'Run history';

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with('graphRun'))
            ->columns([
                TextColumn::make('trigger')
                    ->badge(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        ScheduledTaskRun::STATUS_SUCCEEDED => 'success',
                        ScheduledTaskRun::STATUS_FAILED => 'danger',
                        ScheduledTaskRun::STATUS_RUNNING => 'warning',
                        default => 'gray',
                    }),
                TextColumn::make('items_processed')
                    ->label('Items'),
                TextColumn::make('pipeline_run_uuid')
                    ->label('Linked run')
                    ->copyable()
                    ->placeholder('—')
                    ->toggleable(),
                TextColumn::make('error')
                    ->limit(120)
                    ->wrap()
                    ->placeholder('—')
                    ->toggleable(),
                TextColumn::make('started_at')
                    ->dateTime()
                    ->sortable(),
                TextColumn::make('finished_at')
                    ->dateTime()
                    ->placeholder('—'),
            ])
            ->recordActions([
                Action::make('openRun')
                    ->label(fn (ScheduledTaskRun $record): string => $record->linkedGraphRun()?->isPipeline()
                        ? 'Progress'
                        : 'Worker run')
                    ->url(function (ScheduledTaskRun $record): ?string {
                        $run = $record->linkedGraphRun();

                        return $run instanceof ConceptGraphRun ? $record->urlForGraphRun($run) : null;
                    })
                    ->visible(fn (ScheduledTaskRun $record): bool => $record->linkedGraphRun() !== null),
            ])
            ->defaultSort('id', 'desc')
            ->defaultPaginationPageOption(25)
            ->paginated([25, 50, 100]);
    }

    public function isReadOnly(): bool
    {
        return true;
    }
}
