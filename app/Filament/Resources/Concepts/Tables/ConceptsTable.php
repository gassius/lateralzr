<?php

namespace App\Filament\Resources\Concepts\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Table;

class ConceptsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                \Filament\Tables\Columns\TextColumn::make('display_term')
                    ->label('Term')
                    ->searchable()
                    ->sortable(),
                \Filament\Tables\Columns\TextColumn::make('canonical_key')
                    ->searchable()
                    ->sortable()
                    ->toggleable(),
                \Filament\Tables\Columns\TextColumn::make('display_complexity')
                    ->label('Complexity')
                    ->sortable(),
                \Filament\Tables\Columns\TextColumn::make('display_wiki_url')
                    ->label('Wiki URL')
                    ->limit(50)
                    ->toggleable(),
                \Filament\Tables\Columns\TextColumn::make('display_media_url')
                    ->label('Media URL')
                    ->limit(50)
                    ->toggleable(),
                \Filament\Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                \Filament\Tables\Columns\TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                //
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
