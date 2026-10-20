<?php

namespace App\Filament\Resources\ScheduledTasks\Tables;

use App\Models\ScheduledTask;
use App\Services\ScheduledTasks\ScheduledTaskCatalog;
use App\Services\ScheduledTasks\ScheduledTaskRunner;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Notifications\Notification;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Columns\ToggleColumn;
use Filament\Tables\Table;
use Throwable;

class ScheduledTasksTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('key')
                    ->badge()
                    ->sortable(),
                TextColumn::make('label')
                    ->label('Task')
                    ->state(fn (ScheduledTask $record): string => ScheduledTaskCatalog::label($record->key)),
                ToggleColumn::make('enabled'),
                TextColumn::make('cadence')
                    ->sortable(),
                TextColumn::make('per_run_cap')
                    ->label('Cap')
                    ->sortable(),
                TextColumn::make('last_run_at')
                    ->dateTime()
                    ->placeholder('—')
                    ->sortable(),
                TextColumn::make('next_run_at')
                    ->dateTime()
                    ->placeholder('—')
                    ->sortable(),
            ])
            ->recordActions([
                Action::make('runNow')
                    ->label('Run now')
                    ->requiresConfirmation()
                    ->modalHeading('Run this task now?')
                    ->modalDescription('Enqueues work through the existing pipeline and records a history row.')
                    ->action(function (ScheduledTask $record): void {
                        try {
                            $history = app(ScheduledTaskRunner::class)->run($record);
                            Notification::make()
                                ->title('Task run recorded')
                                ->body("{$history->task_key}: {$history->status}, {$history->items_processed} items")
                                ->success()
                                ->send();
                        } catch (Throwable $e) {
                            Notification::make()
                                ->title('Task run failed')
                                ->body($e->getMessage())
                                ->danger()
                                ->send();
                        }
                    }),
                EditAction::make(),
            ])
            ->defaultSort('id')
            ->paginated(false);
    }
}
