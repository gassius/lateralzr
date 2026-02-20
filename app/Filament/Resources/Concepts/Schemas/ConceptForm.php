<?php

namespace App\Filament\Resources\Concepts\Schemas;

use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class ConceptForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('concept')
                    ->required()
                    ->maxLength(255),
                TextInput::make('wiki_url')
                    ->url()
                    ->maxLength(65535),
                TextInput::make('media_url')
                    ->url()
                    ->maxLength(65535),
            ]);
    }
}
