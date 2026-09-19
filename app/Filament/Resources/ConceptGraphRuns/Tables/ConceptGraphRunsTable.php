<?php

namespace App\Filament\Resources\ConceptGraphRuns\Tables;

use Filament\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

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
                    ->sortable(),
                TextColumn::make('pending_jobs_count')
                    ->label('Pending')
                    ->sortable(),
                TextColumn::make('processing_jobs_count')
                    ->label('Processing')
                    ->sortable(),
                TextColumn::make('succeeded_jobs_count')
                    ->label('Succeeded')
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
}
