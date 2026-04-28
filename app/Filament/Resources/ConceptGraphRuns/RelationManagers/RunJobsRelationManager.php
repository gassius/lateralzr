<?php

namespace App\Filament\Resources\ConceptGraphRuns\RelationManagers;

use App\Jobs\GenerateConceptGraphJob;
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
                    ->label('Start batch')
                    ->description(fn ($record): string => $this->batchDescription((string) $record->seed))
                    ->searchable()
                    ->sortable(),
                TextColumn::make('status')
                    ->badge()
                    ->formatStateUsing(fn ($record): string => $record->display_status)
                    ->color(fn ($record): string => match ($record->display_status) {
                        'pending' => 'gray',
                        'processing' => 'warning',
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
                        'succeeded' => 'succeeded',
                        'failed' => 'failed',
                    ]),
            ])
            ->recordActions([
                Action::make('retryBatch')
                    ->label('Retry batch')
                    ->icon('heroicon-m-arrow-path')
                    ->visible(fn (ConceptGraphRunJob $record): bool => in_array($record->display_status, ['failed', 'timed_out'], true))
                    ->requiresConfirmation()
                    ->action(function (ConceptGraphRunJob $record): void {
                        $run = $record->run;
                        $start = $this->startFromBatchKey((string) $record->seed);

                        $record->update([
                            'status' => 'pending',
                            'attempts' => 0,
                            'started_at' => null,
                            'finished_at' => null,
                            'error_message' => null,
                        ]);

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

    protected function batchDescription(string $seed): string
    {
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
