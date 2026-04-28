<?php

namespace App\Filament\Resources\ConceptRelationships\RelationManagers;

use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class EvidencesRelationManager extends RelationManager
{
    protected static string $relationship = 'evidences';

    public function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('provider')->sortable()->toggleable(),
                TextColumn::make('model')->sortable()->toggleable(),
                TextColumn::make('run_uuid')->label('Run UUID')->copyable()->toggleable(),
                TextColumn::make('laterality')->sortable()->toggleable(),
                TextColumn::make('from_term')->limit(50)->toggleable(),
                TextColumn::make('to_term')->limit(50)->toggleable(),
                TextColumn::make('created_at')->dateTime()->sortable(),
            ])
            ->defaultSort('created_at', 'desc');
    }
}
