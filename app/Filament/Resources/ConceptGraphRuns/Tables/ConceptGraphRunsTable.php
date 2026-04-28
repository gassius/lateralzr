<?php

namespace App\Filament\Resources\ConceptGraphRuns\Tables;

use Filament\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class ConceptGraphRunsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('run_uuid')
                    ->label('Run UUID')
                    ->copyable()
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('provider')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('model')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('complexity')
                    ->label('Label complexity')
                    ->sortable(),
                TextColumn::make('queue')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('seed_count')
                    ->label('Starts')
                    ->sortable(),
                TextColumn::make('related_count')
                    ->label('Target concepts')
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
            ->recordActions([
                ViewAction::make(),
            ])
            ->defaultSort('dispatched_at', 'desc');
    }
}
