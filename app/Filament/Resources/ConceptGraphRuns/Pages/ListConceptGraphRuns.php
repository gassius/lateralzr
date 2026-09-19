<?php

namespace App\Filament\Resources\ConceptGraphRuns\Pages;

use App\Ai\Support\AiProviders;
use App\Filament\Resources\ConceptGraphRuns\ConceptGraphRunResource;
use App\Services\ConceptGraphPrefetchService;
use App\Services\ConceptLocalizeDispatchService;
use App\Support\ConceptLocale;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TagsInput;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;
use Filament\Support\Exceptions\Halt;
use Illuminate\Support\Arr;
use InvalidArgumentException;

class ListConceptGraphRuns extends ListRecords
{
    protected static string $resource = ConceptGraphRunResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('enqueueLocalize')
                ->label('Localize concepts')
                ->modalHeading('Enqueue concept localization')
                ->form([
                    Select::make('from')
                        ->label('From locale')
                        ->options(fn (): array => array_combine(ConceptLocale::supported(), ConceptLocale::supported()))
                        ->default(ConceptLocale::default())
                        ->required(),
                    Select::make('to')
                        ->label('To locale')
                        ->options(fn (): array => array_combine(ConceptLocale::supported(), ConceptLocale::supported()))
                        ->default('es')
                        ->required(),
                    TextInput::make('limit')
                        ->label('Limit (optional)')
                        ->numeric()
                        ->minValue(1),
                    TextInput::make('batch_size')
                        ->label('Batch size')
                        ->helperText('Concepts per queued LLM + Wikipedia batch.')
                        ->numeric()
                        ->default(20)
                        ->minValue(1)
                        ->maxValue(50)
                        ->required(),
                    Toggle::make('missing_only')
                        ->label('Missing target locale only')
                        ->default(true),
                    Select::make('provider')
                        ->label('Provider (optional)')
                        ->options(fn (): array => AiProviders::options())
                        ->searchable(),
                    TextInput::make('model')
                        ->label('Model (optional)'),
                    TextInput::make('queue')
                        ->label('Queue')
                        ->default('default')
                        ->required(),
                ])
                ->action(function (array $data): void {
                    try {
                        $limit = $data['limit'] ?? null;
                        $limit = $limit !== null && $limit !== '' ? (int) $limit : null;

                        app(ConceptLocalizeDispatchService::class)->dispatch(
                            fromLocale: (string) ($data['from'] ?? 'en'),
                            toLocale: (string) ($data['to'] ?? 'es'),
                            limit: $limit,
                            missingOnly: (bool) ($data['missing_only'] ?? true),
                            batchSize: (int) ($data['batch_size'] ?? 20),
                            provider: ($data['provider'] ?? null) ? (string) $data['provider'] : null,
                            model: ($data['model'] ?? null) ? (string) $data['model'] : null,
                            queue: (string) ($data['queue'] ?? 'default'),
                        );
                    } catch (InvalidArgumentException $e) {
                        Notification::make()
                            ->title('Localize not enqueued')
                            ->body($e->getMessage())
                            ->danger()
                            ->send();

                        throw new Halt;
                    }
                })
                ->successNotificationTitle('Localize enqueued'),
            Action::make('enqueuePrefetch')
                ->label('Prefetch concept graph')
                ->modalHeading('Prefetch concept graph')
                ->form([
                    TagsInput::make('starts')
                        ->label('Starting concepts (optional)')
                        ->placeholder('e.g. Cleopatra, The Lumineers, Denver')
                        ->helperText('If empty, use random existing starts or enable random idea.')
                        ->separator(',')
                        ->suggestions(fn () => [])
                        ->columnSpanFull(),
                    TextInput::make('random_existing')
                        ->label('Random existing starts')
                        ->numeric()
                        ->default(0)
                        ->minValue(0)
                        ->required(),
                    Toggle::make('random_idea')
                        ->label('Random idea start')
                        ->default(false),
                    TextInput::make('count')
                        ->label('Target concepts')
                        ->numeric()
                        ->default(100)
                        ->minValue(1)
                        ->maxValue(1000)
                        ->required(),
                    TextInput::make('batch_size')
                        ->label('Batch size')
                        ->helperText('Concepts requested per queued LLM batch.')
                        ->numeric()
                        ->default(10)
                        ->minValue(1)
                        ->maxValue(100)
                        ->required(),
                    TextInput::make('complexity')
                        ->label('Concept label complexity (1–5)')
                        ->numeric()
                        ->default((int) config('concepts.default_complexity', 2))
                        ->minValue(1)
                        ->maxValue(5)
                        ->required(),
                    Select::make('provider')
                        ->label('Provider (optional)')
                        ->options(fn (): array => AiProviders::options())
                        ->searchable(),
                    TextInput::make('model')
                        ->label('Model (optional)'),
                    TextInput::make('queue')
                        ->label('Queue')
                        ->default('default')
                        ->required(),
                ])
                ->action(function (array $data): void {
                    $starts = Arr::wrap($data['starts'] ?? []);
                    $starts = array_values(array_filter(array_map('strval', $starts), fn ($v) => trim($v) !== ''));

                    try {
                        app(ConceptGraphPrefetchService::class)->dispatch(
                            starts: $starts,
                            randomExisting: (int) ($data['random_existing'] ?? 0),
                            randomIdea: (bool) ($data['random_idea'] ?? false),
                            targetCount: (int) ($data['count'] ?? 100),
                            batchSize: (int) ($data['batch_size'] ?? 10),
                            complexity: (int) ($data['complexity'] ?? 2),
                            provider: ($data['provider'] ?? null) ? (string) $data['provider'] : null,
                            model: ($data['model'] ?? null) ? (string) $data['model'] : null,
                            queue: (string) ($data['queue'] ?? 'default'),
                        );
                    } catch (InvalidArgumentException $e) {
                        Notification::make()
                            ->title('Prefetch not enqueued')
                            ->body($e->getMessage())
                            ->danger()
                            ->send();

                        throw new Halt;
                    }
                })
                ->successNotificationTitle('Prefetch enqueued'),
        ];
    }
}
