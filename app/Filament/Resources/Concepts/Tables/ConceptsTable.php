<?php

namespace App\Filament\Resources\Concepts\Tables;

use App\Filament\Support\PreferredTermColumns;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class ConceptsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(function (Builder $query): void {
                $query->with('preferredTerm');
            })
            ->columns([
                TextColumn::make('display_term')
                    ->label('Term')
                    ->searchable(query: fn (Builder $query, string $search): Builder => PreferredTermColumns::searchTerms($query, $search))
                    ->sortable(query: fn (Builder $query, string $direction): Builder => PreferredTermColumns::orderByPreferred($query, 'term', $direction)),
                \Filament\Tables\Columns\TextColumn::make('canonical_key')
                    ->searchable()
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('display_complexity')
                    ->label('Complexity')
                    ->sortable(query: fn (Builder $query, string $direction): Builder => PreferredTermColumns::orderByPreferred($query, 'complexity', $direction)),
                TextColumn::make('display_wiki_url')
                    ->label('Wiki URL')
                    ->limit(50)
                    ->sortable(query: fn (Builder $query, string $direction): Builder => PreferredTermColumns::orderByPreferred($query, 'wiki_url', $direction))
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
