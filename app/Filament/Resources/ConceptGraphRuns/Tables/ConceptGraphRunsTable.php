<?php

namespace App\Filament\Resources\ConceptGraphRuns\Tables;

use Filament\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class ConceptGraphRunsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('type')
                    ->badge()
                    ->formatStateUsing(fn (?string $state): string => match ($state) {
                        'localize' => 'localize',
                        'complete_info' => 'complete_info',
                        default => 'graph',
                    })
                    ->color(fn (?string $state): string => match ($state) {
                        'localize' => 'info',
                        'complete_info' => 'success',
                        default => 'gray',
                    })
                    ->sortable(),
                TextColumn::make('run_uuid')
                    ->label('Run UUID')
                    ->copyable()
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('summary')
                    ->label('Summary')
                    ->state(fn ($record): string => $record->summary)
                    ->searchable(query: function (Builder $query, string $search): Builder {
                        return $query->where(function (Builder $inner) use ($search): void {
                            $inner->where('seeds', 'like', '%'.$search.'%')
                                ->orWhereHas('jobs', function (Builder $jobs) use ($search): void {
                                    $jobs->where('seed', 'like', '%'.$search.'%');
                                });
                        });
                    })
                    ->wrap()
                    ->toggleable(),
                TextColumn::make('provider')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('model')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('complexity')
                    ->label('Label complexity')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('queue')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('seed_count')
                    ->label('Batches')
                    ->sortable(),
                TextColumn::make('target_count')
                    ->label('Target')
                    ->state(fn ($record): ?int => $record->target_count)
                    ->sortable(query: fn (Builder $query, string $direction): Builder => self::orderByTargetCount($query, $direction)),
                TextColumn::make('pending_jobs_count')
                    ->label('Pending')
                    ->sortable(),
                TextColumn::make('processing_jobs_count')
                    ->label('Processing')
                    ->sortable(),
                TextColumn::make('succeeded_jobs_count')
                    ->label('Succeeded')
                    ->sortable(),
                TextColumn::make('partial_jobs_count')
                    ->label('Partial')
                    ->sortable(),
                TextColumn::make('failed_jobs_count')
                    ->label('Failed')
                    ->sortable(),
                TextColumn::make('dispatched_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(),
            ])
            ->filters([
                SelectFilter::make('type')
                    ->options([
                        'graph' => 'graph',
                        'localize' => 'localize',
                        'complete_info' => 'complete_info',
                    ]),
            ])
            ->recordActions([
                ViewAction::make(),
            ])
            ->defaultSort('dispatched_at', 'desc');
    }

    /**
     * Target is stored as seeds.targetCount JSON, not a table column.
     */
    public static function orderByTargetCount(Builder $query, string $direction): Builder
    {
        $direction = strtolower($direction) === 'desc' ? 'desc' : 'asc';

        $expression = $query->getConnection()->getDriverName() === 'sqlite'
            ? "CAST(json_extract(seeds, '$.targetCount') AS INTEGER)"
            : 'CAST(JSON_UNQUOTE(JSON_EXTRACT(seeds, \'$.targetCount\')) AS UNSIGNED)';

        return $query->orderByRaw("{$expression} {$direction}");
    }
}
