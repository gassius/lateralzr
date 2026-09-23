<?php

namespace App\Filament\Resources\ConceptGraphRuns\RelationManagers;

use App\Jobs\CompleteConceptInfoBatchJob;
use App\Jobs\GenerateConceptGraphJob;
use App\Jobs\LocalizeConceptBatchJob;
use App\Models\ConceptGraphRun;
use App\Models\ConceptGraphRunJob;
use Filament\Actions\Action;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Support\Enums\FontFamily;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class RunJobsRelationManager extends RelationManager
{
    protected static string $relationship = 'jobs';

    public function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('seed')
                    ->label('Batch')
                    ->description(fn ($record): string => $this->batchDescription((string) $record->seed, $record->run))
                    ->searchable()
                    ->sortable(),
                TextColumn::make('status')
                    ->badge()
                    ->formatStateUsing(fn ($record): string => $record->display_status)
                    ->color(fn ($record): string => match ($record->display_status) {
                        'pending' => 'gray',
                        'processing' => 'warning',
                        'partial' => 'warning',
                        'succeeded' => 'success',
                        'failed' => 'danger',
                        'timed_out' => 'danger',
                        default => 'gray',
                    })
                    ->sortable(),
                TextColumn::make('attempts')
                    ->sortable(),
                TextColumn::make('started_at')
                    ->dateTime()
                    ->toggleable(),
                TextColumn::make('finished_at')
                    ->dateTime()
                    ->toggleable(),
                TextColumn::make('display_error')
                    ->label('Error')
                    ->fontFamily(FontFamily::Mono)
                    ->limit(220)
                    ->wrap()
                    ->copyable()
                    ->placeholder('No error recorded'),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options([
                        'pending' => 'pending',
                        'processing' => 'processing',
                        'partial' => 'partial',
                        'succeeded' => 'succeeded',
                        'failed' => 'failed',
                    ]),
            ])
            ->recordActions([
                Action::make('retryBatch')
                    ->label('Retry batch')
                    ->icon('heroicon-m-arrow-path')
                    ->visible(fn (ConceptGraphRunJob $record): bool => in_array($record->display_status, ['failed', 'timed_out', 'partial'], true))
                    ->requiresConfirmation()
                    ->action(function (ConceptGraphRunJob $record): void {
                        $run = $record->run;

                        $record->update([
                            'status' => 'pending',
                            'attempts' => 0,
                            'started_at' => null,
                            'finished_at' => null,
                            'error_message' => null,
                        ]);

                        if ($run instanceof ConceptGraphRun && $run->isLocalize()) {
                            $conceptIds = data_get($run->seeds, 'batches.'.$record->seed, []);
                            if (! is_array($conceptIds) || $conceptIds === []) {
                                return;
                            }

                            LocalizeConceptBatchJob::dispatch(
                                conceptIds: array_values(array_map('intval', $conceptIds)),
                                fromLocale: (string) data_get($run->seeds, 'from', 'en'),
                                toLocale: (string) data_get($run->seeds, 'to', 'es'),
                                missingOnly: (bool) data_get($run->seeds, 'missingOnly', true),
                                provider: $run->provider,
                                model: $run->model,
                                runUuid: $run->run_uuid,
                                jobKey: $record->seed,
                            )->onQueue((string) $run->queue);

                            return;
                        }

                        if ($run instanceof ConceptGraphRun && $run->isCompleteInfo()) {
                            $termIds = data_get($run->seeds, 'batches.'.$record->seed, []);
                            if (! is_array($termIds) || $termIds === []) {
                                return;
                            }

                            CompleteConceptInfoBatchJob::dispatch(
                                termIds: array_values(array_map('intval', $termIds)),
                                mode: (string) data_get($run->seeds, 'mode', 'both'),
                                runUuid: $run->run_uuid,
                                jobKey: $record->seed,
                            )->onQueue((string) $run->queue);

                            return;
                        }

                        $start = $this->startFromBatchKey((string) $record->seed);

                        GenerateConceptGraphJob::dispatch(
                            seed: $start,
                            count: (int) data_get($run->seeds, 'batchSize', 10),
                            complexity: (int) $run->complexity,
                            provider: $run->provider,
                            model: $run->model,
                            runUuid: $run->run_uuid,
                            jobKey: $record->seed
                        )->onQueue((string) $run->queue);
                    }),
            ])
            ->defaultSort('created_at', 'desc');
    }

    protected function batchDescription(string $seed, ?ConceptGraphRun $run): string
    {
        if ($run?->isLocalize()) {
            $ids = data_get($run->seeds, 'batches.'.$seed, []);
            $count = is_array($ids) ? count($ids) : 0;

            return "Localize batch · {$count} concept(s)";
        }

        if ($run?->isCompleteInfo()) {
            $ids = data_get($run->seeds, 'batches.'.$seed, []);
            $count = is_array($ids) ? count($ids) : 0;
            $mode = (string) data_get($run->seeds, 'mode', 'both');

            return "Complete info ({$mode}) · {$count} term(s)";
        }

        if (! str_contains($seed, '#')) {
            return 'Single batch';
        }

        [$start, $batch] = explode('#', $seed, 2);

        return "Start: {$start} · Batch {$batch}";
    }

    protected function startFromBatchKey(string $seed): ?string
    {
        [$start] = explode('#', $seed, 2);

        return $start === 'random-idea' ? null : $start;
    }
}
