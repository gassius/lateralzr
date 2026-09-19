<?php

namespace App\Filament\Resources\Concepts\Schemas;

use App\Support\ConceptLocale;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class ConceptForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('canonical_key')
                    ->required()
                    ->maxLength(255)
                    ->helperText('Language-neutral identity. Localized labels live on terms below.'),
                Repeater::make('terms')
                    ->relationship()
                    ->label('Localized terms')
                    ->defaultItems(1)
                    ->minItems(1)
                    ->itemLabel(fn (array $state): ?string => isset($state['locale'])
                        ? strtoupper((string) $state['locale']).': '.((string) ($state['term'] ?? ''))
                        : null)
                    ->schema([
                        Select::make('locale')
                            ->label('Locale')
                            ->options(ConceptLocale::options())
                            ->default(ConceptLocale::default())
                            ->required()
                            ->native(false),
                        TextInput::make('term')
                            ->label('Term')
                            ->required()
                            ->maxLength(255),
                        Textarea::make('short_description')
                            ->label('Short description')
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
                            ->label('Wikipedia URL')
                            ->url()
                            ->maxLength(65535),
                        TextInput::make('media_url')
                            ->label('Media URL')
                            ->url()
                            ->maxLength(65535)
                            ->helperText('Usually shared across locales; override only when needed.'),
                        Toggle::make('is_preferred')
                            ->label('Preferred for this locale')
                            ->default(true),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->cloneable(),
            ]);
    }
}
