<?php

namespace App\Filament\Resources\ConceptRelationships\Schemas;

use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class ConceptRelationshipForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('from_concept_id')
                    ->disabled(),
                TextInput::make('to_concept_id')
                    ->disabled(),
                TextInput::make('relationship_type')
                    ->required()
                    ->maxLength(32),
                TextInput::make('complexity')
                    ->numeric()
                    ->disabled(),
                TextInput::make('strength')
                    ->numeric()
                    ->minValue(0)
                    ->maxValue(1)
                    ->step(0.00001)
                    ->required(),
                TextInput::make('llm_occurrences')
                    ->numeric()
                    ->disabled(),
                TextInput::make('user_weight')
                    ->numeric()
                    ->required(),
                TextInput::make('last_larelality')
                    ->numeric()
                    ->disabled(),
            ]);
    }
}

