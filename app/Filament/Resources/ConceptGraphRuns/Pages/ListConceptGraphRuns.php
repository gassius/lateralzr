<?php

namespace App\Filament\Resources\ConceptGraphRuns\Pages;

use App\Ai\Support\AiProviders;
use App\Filament\Resources\ConceptGraphRuns\ConceptGraphRunResource;
use App\Services\ConceptCompleteInfoDispatchService;
use App\Services\ConceptGraphPrefetchService;
use App\Services\ConceptLocalizeDispatchService;
use App\Services\ConceptPipeline\ConceptPipelineDispatchService;
use App\Support\ConceptLocale;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TagsInput;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Support\Exceptions\Halt;
use Illuminate\Support\Arr;
use InvalidArgumentException;

class ListConceptGraphRuns extends ListRecords
{
    protected static string $resource = ConceptGraphRunResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('enqueueGenerate')
                ->label('Generate concepts')
                ->modalHeading('Generate concepts')
                ->form([
                    TagsInput::make('concepts')
                        ->label('Starting concepts')
                        ->placeholder('e.g. Cleopatra, The Lumineers, Denver')
                        ->helperText('One or more labels (existing or new). At most 255 characters each. Leave empty and set random starts, or combine both.')
                        ->separator(',')
                        ->nestedRecursiveRules(['string', 'max:'.ConceptPipelineDispatchService::MAX_LABEL_LENGTH])
                        ->suggestions(fn () => [])
                        ->columnSpanFull(),
                    TextInput::make('random')
                        ->label('Random existing starts')
                        ->numeric()
                        ->default(0)
                        ->minValue(0)
                        ->required(),
                    TextInput::make('count')
                        ->label('Related concepts per node')
                        ->helperText('One LLM call per node requests this many related concepts. There is no batch size.')
                        ->numeric()
                        ->default(ConceptPipelineDispatchService::DEFAULT_COUNT)
                        ->minValue(1)
                        ->maxValue(100)
                        ->required(),
                    TextInput::make('complexity')
                        ->label('Concept label complexity (1–5)')
                        ->numeric()
                        ->default(ConceptPipelineDispatchService::DEFAULT_COMPLEXITY)
                        ->minValue(1)
                        ->maxValue(5)
                        ->required(),
                    TextInput::make('depth')
                        ->label('Expansion depth')
                        ->helperText('Hops from each start. Default 1, maximum 3. Hard cap 200 concepts per run.')
                        ->numeric()
                        ->default(ConceptPipelineDispatchService::DEFAULT_DEPTH)
                        ->minValue(1)
                        ->maxValue(ConceptPipelineDispatchService::MAX_DEPTH)
                        ->required(),
                    Select::make('locales')
                        ->label('Locales to localise into')
                        ->multiple()
                        ->options(fn (): array => array_combine(ConceptLocale::supported(), ConceptLocale::supported()))
                        ->default(fn (): array => array_values(array_filter(
                            ConceptLocale::supported(),
                            fn (string $locale): bool => $locale !== ConceptLocale::default()
                        )))
                        ->helperText('Default locale is written by generate; these locales are translated next.'),
                    ...$this->providerModelFields(),
                    TextInput::make('queue')
                        ->label('Queue')
                        ->default('default')
                        ->required(),
                ])
                ->action(function (array $data): void {
                    $concepts = Arr::wrap($data['concepts'] ?? []);
                    $concepts = array_values(array_filter(array_map('strval', $concepts), fn ($v) => trim($v) !== ''));
                    $locales = $data['locales'] ?? null;
                    $locales = is_array($locales) ? array_values(array_map('strval', $locales)) : null;

                    try {
                        app(ConceptPipelineDispatchService::class)->dispatch(
                            concepts: $concepts,
                            random: (int) ($data['random'] ?? 0),
                            count: (int) ($data['count'] ?? ConceptPipelineDispatchService::DEFAULT_COUNT),
                            complexity: (int) ($data['complexity'] ?? ConceptPipelineDispatchService::DEFAULT_COMPLEXITY),
                            depth: (int) ($data['depth'] ?? ConceptPipelineDispatchService::DEFAULT_DEPTH),
                            locales: $locales,
                            provider: ($data['provider'] ?? null) ? (string) $data['provider'] : null,
                            model: ($data['model'] ?? null) ? (string) $data['model'] : null,
                            queue: (string) ($data['queue'] ?? 'default'),
                        );
                    } catch (InvalidArgumentException $e) {
                        Notification::make()
                            ->title('Generate not enqueued')
                            ->body($e->getMessage())
                            ->danger()
                            ->send();

                        throw new Halt;
                    }
                })
                ->successNotificationTitle('Generate enqueued'),
            Action::make('enqueueCompleteInfo')
                ->label('Complete concept info')
                ->modalHeading('Enqueue Wikipedia / media backfill')
                ->form([
                    Select::make('locale')
                        ->label('Locale (optional)')
                        ->options(fn (): array => array_combine(ConceptLocale::supported(), ConceptLocale::supported()))
                        ->placeholder('All locales')
                        ->helperText('Leave empty to backfill terms in every supported locale.'),
                    Select::make('mode')
                        ->label('What to fill')
                        ->options([
                            'both' => 'Wikipedia + media (missing either)',
                            'wiki' => 'Wikipedia URLs only',
                            'media' => 'Wikimedia media only',
                        ])
                        ->default('both')
                        ->required(),
                    TextInput::make('limit')
                        ->label('Limit (optional)')
                        ->numeric()
                        ->minValue(1),
                    TextInput::make('batch_size')
                        ->label('Batch size')
                        ->helperText('Terms per queued Wikipedia / Wikimedia batch. Keep small so lookups finish under the 300s worker timeout.')
                        ->numeric()
                        ->default(10)
                        ->minValue(1)
                        ->maxValue(20)
                        ->required(),
                    TextInput::make('queue')
                        ->label('Queue')
                        ->default('default')
                        ->required(),
                ])
                ->action(function (array $data): void {
                    try {
                        $limit = $data['limit'] ?? null;
                        $limit = $limit !== null && $limit !== '' ? (int) $limit : null;
                        $locale = $data['locale'] ?? null;
                        $locale = is_string($locale) && trim($locale) !== '' ? (string) $locale : null;

                        app(ConceptCompleteInfoDispatchService::class)->dispatch(
                            locale: $locale,
                            mode: (string) ($data['mode'] ?? 'both'),
                            limit: $limit,
                            batchSize: (int) ($data['batch_size'] ?? 10),
                            queue: (string) ($data['queue'] ?? 'default'),
                        );
                    } catch (InvalidArgumentException $e) {
                        Notification::make()
                            ->title('Complete info not enqueued')
                            ->body($e->getMessage())
                            ->danger()
                            ->send();

                        throw new Halt;
                    }
                })
                ->successNotificationTitle('Complete info enqueued'),
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
                        ->helperText('Concepts per queued LLM translation batch.')
                        ->numeric()
                        ->default(20)
                        ->minValue(1)
                        ->maxValue(50)
                        ->required(),
                    Toggle::make('missing_only')
                        ->label('Missing target locale only')
                        ->default(true),
                    ...$this->providerModelFields(),
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
                ->label('Prefetch concept graph (legacy)')
                ->modalHeading('Prefetch concept graph (legacy)')
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
                        ->label('Concept complexity (1–5, conceptual difficulty)')
                        ->numeric()
                        ->default((int) config('concepts.default_complexity', 3))
                        ->minValue(1)
                        ->maxValue(5)
                        ->required(),
                    ...$this->providerModelFields(),
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
                            complexity: (int) ($data['complexity'] ?? config('concepts.default_complexity', 3)),
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

    /**
     * @return array{0: Select, 1: TextInput}
     */
    protected function providerModelFields(): array
    {
        return [
            Select::make('provider')
                ->label('Provider (optional)')
                ->options(fn (): array => AiProviders::options())
                ->helperText(fn (): string => 'Empty uses '.(string) config('ai.default', 'ollama').'.')
                ->searchable()
                ->live(),
            TextInput::make('model')
                ->label('Model (optional)')
                ->placeholder(fn (Get $get): string => AiProviders::defaultTextModel($this->selectedProvider($get)))
                ->helperText(fn (Get $get): string => self::modelFieldHelper($this->selectedProvider($get))),
        ];
    }

    public static function modelFieldHelper(?string $provider = null): string
    {
        return 'Empty uses '.AiProviders::defaultTextModel($provider).'.';
    }

    protected function selectedProvider(Get $get): ?string
    {
        $provider = $get('provider');

        return is_string($provider) && trim($provider) !== '' ? $provider : null;
    }
}
