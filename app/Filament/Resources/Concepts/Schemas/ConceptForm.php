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
                    ->columnSpanFull()
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
                            ->default((int) config('concepts.default_complexity', 3))
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
                Repeater::make('media')
                    ->relationship()
                    ->label('Qualified media')
                    ->helperText('More than one URL per concept. Automated enrichment stores only CC0 or public domain (no attribution).')
                    ->defaultItems(0)
                    ->addActionLabel('Add media')
                    ->schema([
                        TextInput::make('url')
                            ->label('URL')
                            ->url()
                            ->required()
                            ->columnSpanFull(),
                        Select::make('kind')
                            ->options([
                                'image' => 'Image',
                                'clip' => 'Clip',
                            ])
                            ->default('image')
                            ->required()
                            ->native(false),
                        TextInput::make('license')
                            ->required()
                            ->default('CC0')
                            ->helperText('CC0 or Public domain only.')
                            ->rule(static function (): \Closure {
                                return static function (string $attribute, mixed $value, \Closure $fail): void {
                                    $normalized = strtolower(trim((string) $value));
                                    if (! in_array($normalized, ['cc0', 'public domain'], true)) {
                                        $fail('License must be CC0 or Public domain.');
                                    }
                                };
                            }),
                        TextInput::make('source')
                            ->default('wikimedia')
                            ->maxLength(32),
                        TextInput::make('position')
                            ->numeric()
                            ->default(0)
                            ->minValue(0)
                            ->maxValue(255),
                        Select::make('purpose')
                            ->options([
                                'photo' => 'Photo',
                                'diagram' => 'Diagram',
                                'map' => 'Map',
                                'artwork' => 'Artwork',
                                'text-bearing' => 'Text-bearing',
                            ])
                            ->native(false),
                        TextInput::make('alt')
                            ->label('Alt text')
                            ->maxLength(160)
                            ->columnSpanFull(),
                        TextInput::make('creator')
                            ->maxLength(255),
                        TextInput::make('source_page_url')
                            ->label('Source page URL')
                            ->url()
                            ->maxLength(65535)
                            ->columnSpanFull(),
                        TextInput::make('licence_name')
                            ->label('Licence name')
                            ->maxLength(128),
                        TextInput::make('licence_url')
                            ->label('Licence URL')
                            ->url()
                            ->maxLength(65535)
                            ->columnSpanFull(),
                        TextInput::make('change_notice')
                            ->label('Change notice')
                            ->helperText('Machine token: cropped or resized.')
                            ->maxLength(32),
                        TextInput::make('focal_x')
                            ->label('Focal X')
                            ->numeric()
                            ->minValue(0)
                            ->maxValue(1),
                        TextInput::make('focal_y')
                            ->label('Focal Y')
                            ->numeric()
                            ->minValue(0)
                            ->maxValue(1),
                        Select::make('tone')
                            ->options([
                                'dark' => 'Dark',
                                'busy' => 'Busy',
                            ])
                            ->native(false),
                    ])
                    ->columns(2)
                    ->collapsible(),
            ]);
    }
}
