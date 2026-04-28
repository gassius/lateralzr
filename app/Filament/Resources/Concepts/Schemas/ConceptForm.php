<?php

namespace App\Filament\Resources\Concepts\Schemas;

use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class ConceptForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('canonical_key')
                    ->required()
                    ->maxLength(255),
                TextInput::make('term')
                    ->label('Preferred term (en)')
                    ->required()
                    ->maxLength(255),
                Textarea::make('short_description')
                    ->label('Short description (en)')
                    ->rows(3)
                    ->maxLength(65535),
                TextInput::make('complexity')
                    ->label('Concept label complexity')
                    ->numeric()
                    ->default((int) config('concepts.default_complexity', 2))
                    ->minValue(1)
                    ->maxValue(5)
                    ->required(),
                TextInput::make('wiki_url')
                    ->label('Wikipedia URL (en)')
                    ->url()
                    ->maxLength(65535),
                TextInput::make('media_url')
                    ->label('Media URL (en)')
                    ->url()
                    ->maxLength(65535),
            ]);
    }
}
