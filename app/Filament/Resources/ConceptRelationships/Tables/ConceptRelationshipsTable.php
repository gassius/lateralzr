<?php

namespace App\Filament\Resources\ConceptRelationships\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class ConceptRelationshipsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(function (Builder $query) {
                $query->with(['fromConcept.preferredTerm', 'toConcept.preferredTerm']);
            })
            ->columns([
                TextColumn::make('fromConcept.display_term')
                    ->label('From')
                    ->searchable(query: function (Builder $query, string $search): Builder {
                        return $query->whereHas('fromConcept.terms', function (Builder $q) use ($search) {
                            $q->where('term', 'like', "%{$search}%");
                        });
                    })
                    ->sortable(),
                TextColumn::make('toConcept.display_term')
                    ->label('To')
                    ->searchable(query: function (Builder $query, string $search): Builder {
                        return $query->whereHas('toConcept.terms', function (Builder $q) use ($search) {
                            $q->where('term', 'like', "%{$search}%");
                        });
                    })
                    ->sortable(),
                TextColumn::make('relationship_type')
                    ->badge()
                    ->sortable(),
                TextColumn::make('complexity')
                    ->sortable(),
                TextColumn::make('strength')
                    ->numeric(decimalPlaces: 5)
                    ->sortable(),
                TextColumn::make('llm_occurrences')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('user_weight')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('last_generated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(),
            ])
            ->filters([
                SelectFilter::make('relationship_type')
                    ->options(fn () => [
                        'lateral' => 'lateral',
                        'broader' => 'broader',
                        'narrower' => 'narrower',
                        'related' => 'related',
                    ]),
                SelectFilter::make('complexity')
                    ->options([
                        1 => '1',
                        2 => '2',
                        3 => '3',
                        4 => '4',
                        5 => '5',
                    ]),
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ])
            ->defaultSort('strength', 'desc');
    }
}

