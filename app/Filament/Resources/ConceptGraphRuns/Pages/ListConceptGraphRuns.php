<?php

namespace App\Filament\Resources\ConceptGraphRuns\Pages;

use App\Filament\Resources\ConceptGraphRuns\ConceptGraphRunResource;
use App\Services\ConceptGraphPrefetchService;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TagsInput;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Support\Arr;

class ListConceptGraphRuns extends ListRecords
{
    protected static string $resource = ConceptGraphRunResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('enqueuePrefetch')
                ->label('Prefetch concept graph')
                ->modalHeading('Prefetch concept graph')
                ->form([
                    TagsInput::make('seeds')
                        ->label('Seeds (optional)')
                        ->placeholder('e.g. creativity, attention, empathy')
                        ->helperText('If empty, we’ll pick random seeds from the DB.')
                        ->separator(',')
                        ->suggestions(fn () => [])
                        ->columnSpanFull(),
                    TextInput::make('n')
                        ->label('Random seeds (if none provided)')
                        ->numeric()
                        ->default(25)
                        ->minValue(1)
                        ->required(),
                    TextInput::make('count')
                        ->label('Related concepts per seed (optional)')
                        ->numeric()
                        ->minValue(1)
                        ->maxValue(10),
                    TextInput::make('complexity')
                        ->label('Complexity (1–5)')
                        ->numeric()
                        ->default((int) config('concepts.default_complexity', 2))
                        ->minValue(1)
                        ->maxValue(5)
                        ->required(),
                    Select::make('provider')
                        ->label('Provider (optional)')
                        ->options([
                            'ollama' => 'ollama',
                            'openai' => 'openai',
                            'anthropic' => 'anthropic',
                            'gemini' => 'gemini',
                        ])
                        ->searchable(),
                    TextInput::make('model')
                        ->label('Model (optional)'),
                    TextInput::make('queue')
                        ->label('Queue')
                        ->default('default')
                        ->required(),
                ])
                ->action(function (array $data): void {
                    $seeds = Arr::wrap($data['seeds'] ?? []);
                    $seeds = array_values(array_filter(array_map('strval', $seeds), fn ($v) => trim($v) !== ''));

                    app(ConceptGraphPrefetchService::class)->dispatch(
                        seeds: $seeds,
                        nIfNoneProvided: (int) ($data['n'] ?? 25),
                        relatedCount: ($data['count'] ?? null) !== null ? (int) $data['count'] : null,
                        complexity: (int) ($data['complexity'] ?? 2),
                        provider: ($data['provider'] ?? null) ? (string) $data['provider'] : null,
                        model: ($data['model'] ?? null) ? (string) $data['model'] : null,
                        queue: (string) ($data['queue'] ?? 'default'),
                    );
                })
                ->successNotificationTitle('Prefetch enqueued'),
        ];
    }
}

