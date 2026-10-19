<?php

namespace App\Filament\Resources\ScheduledTasks\Pages;

use App\Filament\Resources\ScheduledTasks\ScheduledTaskResource;
use App\Models\ScheduledTask;
use App\Services\ScheduledTasks\ScheduledTaskCatalog;
use App\Services\ScheduledTasks\ScheduledTaskRunner;
use Filament\Actions\Action;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use InvalidArgumentException;
use Throwable;

class EditScheduledTask extends EditRecord
{
    protected static string $resource = ScheduledTaskResource::class;

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeSave(array $data): array
    {
        /** @var ScheduledTask $record */
        $record = $this->getRecord();
        $data['key'] = $record->key;

        try {
            $data['cadence'] = ScheduledTaskCatalog::normalizeCadence((string) ($data['cadence'] ?? $record->cadence));
            $data['per_run_cap'] = ScheduledTaskCatalog::normalizeCap((int) ($data['per_run_cap'] ?? $record->per_run_cap));
            $data['options'] = ScheduledTaskCatalog::normalizeOptions(
                $record->key,
                is_array($data['options'] ?? null) ? $data['options'] : []
            );
        } catch (InvalidArgumentException $e) {
            Notification::make()
                ->title('Could not save task')
                ->body($e->getMessage())
                ->danger()
                ->send();

            $this->halt();
        }

        return $data;
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('runNow')
                ->label('Run now')
                ->requiresConfirmation()
                ->action(function (): void {
                    try {
                        $history = app(ScheduledTaskRunner::class)->run($this->getRecord());
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
        ];
    }
}
