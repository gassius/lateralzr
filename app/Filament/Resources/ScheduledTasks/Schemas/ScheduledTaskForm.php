<?php

namespace App\Filament\Resources\ScheduledTasks\Schemas;

use App\Models\ScheduledTask;
use App\Services\ScheduledTasks\ScheduledTaskCatalog;
use App\Support\ConceptLocale;
use Filament\Forms\Components\Placeholder;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Schema;

class ScheduledTaskForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Schedule')
                    ->schema([
                        TextInput::make('key')
                            ->disabled()
                            ->dehydrated(true),
                        Toggle::make('enabled')
                            ->label('Enabled')
                            ->helperText('Off by default. When enabled, the scheduler runs this task at the configured cadence.'),
                        TextInput::make('cadence')
                            ->required()
                            ->helperText('hourly, daily, weekly, or a cron expression such as 0 3 * * *'),
                        TextInput::make('per_run_cap')
                            ->label('Per-run cap')
                            ->numeric()
                            ->minValue(1)
                            ->maxValue(200)
                            ->required(),
                        Placeholder::make('last_run_display')
                            ->label('Last run')
                            ->content(fn (?ScheduledTask $record): string => $record?->last_run_at?->toDateTimeString() ?? '—'),
                        Placeholder::make('next_run_display')
                            ->label('Next run')
                            ->content(fn (?ScheduledTask $record): string => $record?->next_run_at?->toDateTimeString() ?? '—'),
                    ])
                    ->columns(2),
                Section::make('Grow sparse options')
                    ->visible(fn (Get $get): bool => $get('key') === ScheduledTaskCatalog::GROW_SPARSE)
                    ->schema([
                        TextInput::make('options.threshold')
                            ->label('Relationship threshold')
                            ->helperText('Concepts with fewer than this many relationships (in + out) are grown.')
                            ->numeric()
                            ->minValue(0)
                            ->required(),
                        TextInput::make('options.count')
                            ->label('Related concepts per node')
                            ->numeric()
                            ->minValue(1)
                            ->maxValue(100)
                            ->required(),
                        TextInput::make('options.complexity')
                            ->label('Concept label complexity (1–5)')
                            ->numeric()
                            ->minValue(1)
                            ->maxValue(5)
                            ->required(),
                        TextInput::make('options.depth')
                            ->label('Expansion depth')
                            ->numeric()
                            ->minValue(1)
                            ->maxValue(3)
                            ->required(),
                    ])
                    ->columns(2),
                Section::make('Fill missing options')
                    ->visible(fn (Get $get): bool => $get('key') === ScheduledTaskCatalog::FILL_MISSING)
                    ->schema([
                        Select::make('options.locale')
                            ->label('Target locale')
                            ->options(fn (): array => array_combine(
                                ConceptLocale::supported(),
                                ConceptLocale::supported()
                            ))
                            ->required(),
                        Select::make('options.from')
                            ->label('Source locale')
                            ->options(fn (): array => array_combine(
                                ConceptLocale::supported(),
                                ConceptLocale::supported()
                            ))
                            ->required(),
                        Toggle::make('options.fill_locale')
                            ->label('Fill missing locale')
                            ->helperText('Enqueue concepts:localize for concepts missing the target locale.'),
                        Toggle::make('options.fill_images')
                            ->label('Fill missing images')
                            ->helperText('Enqueue complete-info (Wikimedia) for terms without a media URL. No AI images.'),
                    ])
                    ->columns(2),
            ]);
    }
}
