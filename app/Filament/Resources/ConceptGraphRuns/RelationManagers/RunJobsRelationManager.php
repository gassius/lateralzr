<?php

namespace App\Filament\Resources\ConceptGraphRuns\RelationManagers;

use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class RunJobsRelationManager extends RelationManager
{
    protected static string $relationship = 'jobs';

    public function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('seed')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('status')
                    ->badge()
                    ->sortable(),
                TextColumn::make('attempts')
                    ->sortable(),
                TextColumn::make('started_at')
                    ->dateTime()
                    ->toggleable(),
                TextColumn::make('finished_at')
                    ->dateTime()
                    ->toggleable(),
                TextColumn::make('error_message')
                    ->limit(100)
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options([
                        'pending' => 'pending',
                        'processing' => 'processing',
                        'succeeded' => 'succeeded',
                        'failed' => 'failed',
                    ]),
            ])
            ->defaultSort('created_at', 'desc');
    }
}

