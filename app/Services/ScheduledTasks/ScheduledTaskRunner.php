<?php

namespace App\Services\ScheduledTasks;

use App\Models\ScheduledTask;
use App\Models\ScheduledTaskRun;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Throwable;

class ScheduledTaskRunner
{
    public function dispatchDue(): int
    {
        $ran = 0;

        $ids = ScheduledTask::query()
            ->where('enabled', true)
            ->orderBy('id')
            ->pluck('id');

        foreach ($ids as $id) {
            $claimed = $this->claimDue((int) $id);
            if ($claimed === null) {
                continue;
            }

            $this->finish($claimed['task'], $claimed['run'], rethrow: false);
            $ran++;
        }

        return $ran;
    }

    public function run(ScheduledTask|string $task, string $trigger = ScheduledTaskRun::TRIGGER_MANUAL): ScheduledTaskRun
    {
        $key = $task instanceof ScheduledTask ? $task->key : $task;
        ScheduledTaskCatalog::assertKnown($key);

        $claimed = DB::transaction(function () use ($key, $trigger): array {
            $record = ScheduledTask::query()->where('key', $key)->lockForUpdate()->first();
            if (! $record instanceof ScheduledTask) {
                throw new InvalidArgumentException("Unknown scheduled task [{$key}].");
            }

            return [
                'task' => $record,
                'run' => $this->startHistory($record, $trigger),
            ];
        });

        $claimed['task']->markRan();

        return $this->finish($claimed['task'], $claimed['run'], rethrow: true);
    }

    public function enable(string $key): ScheduledTask
    {
        return $this->setEnabled($key, true);
    }

    public function disable(string $key): ScheduledTask
    {
        return $this->setEnabled($key, false);
    }

    public function setEnabled(string $key, bool $enabled): ScheduledTask
    {
        ScheduledTaskCatalog::assertKnown($key);
        $task = $this->require($key);
        $task->enabled = $enabled;
        if ($enabled && $task->next_run_at === null) {
            $task->next_run_at = now();
        }
        $task->save();

        return $task->fresh() ?? $task;
    }

    public function configure(string $key, ?string $cadence = null, ?int $cap = null): ScheduledTask
    {
        ScheduledTaskCatalog::assertKnown($key);
        $task = $this->require($key);

        if ($cadence !== null) {
            $task->cadence = ScheduledTaskCatalog::normalizeCadence($cadence);
        }

        if ($cap !== null) {
            $task->per_run_cap = ScheduledTaskCatalog::normalizeCap($cap);
        }

        $task->save();

        return $task->fresh() ?? $task;
    }

    /**
     * @return array{task: ScheduledTask, run: ScheduledTaskRun}|null
     */
    protected function claimDue(int $id): ?array
    {
        $claimed = DB::transaction(function () use ($id): ?array {
            $task = ScheduledTask::query()->whereKey($id)->lockForUpdate()->first();
            if (! $task instanceof ScheduledTask || ! $task->isDue()) {
                return null;
            }

            return [
                'task' => $task,
                'run' => $this->startHistory($task, ScheduledTaskRun::TRIGGER_SCHEDULED),
            ];
        });

        if ($claimed === null) {
            return null;
        }

        $claimed['task']->markRan();

        return $claimed;
    }

    protected function startHistory(ScheduledTask $task, string $trigger): ScheduledTaskRun
    {
        return ScheduledTaskRun::query()->create([
            'scheduled_task_id' => $task->id,
            'task_key' => $task->key,
            'trigger' => $trigger,
            'status' => ScheduledTaskRun::STATUS_RUNNING,
            'items_processed' => 0,
            'started_at' => now(),
        ]);
    }

    protected function finish(ScheduledTask $task, ScheduledTaskRun $history, bool $rethrow): ScheduledTaskRun
    {
        try {
            $result = $this->handlerFor($task->key)->handle($task);
            $history->fill([
                'status' => ScheduledTaskRun::STATUS_SUCCEEDED,
                'items_processed' => (int) ($result['items_processed'] ?? 0),
                'pipeline_run_uuid' => $result['pipeline_run_uuid'] ?? null,
                'details' => $result['details'] ?? [],
                'finished_at' => now(),
            ]);
            $history->save();
        } catch (Throwable $e) {
            $history->fill([
                'status' => ScheduledTaskRun::STATUS_FAILED,
                'error' => $e->getMessage(),
                'finished_at' => now(),
            ]);
            $history->save();

            if ($rethrow) {
                throw $e;
            }

            report($e);
        }

        return $history->fresh() ?? $history;
    }

    protected function handlerFor(string $key): ScheduledTaskHandler
    {
        return match ($key) {
            ScheduledTaskCatalog::GROW_SPARSE => app(GrowSparseHandler::class),
            ScheduledTaskCatalog::FILL_MISSING => app(FillMissingHandler::class),
            default => throw new InvalidArgumentException("Unknown scheduled task [{$key}]."),
        };
    }

    protected function require(string $key): ScheduledTask
    {
        $task = ScheduledTask::query()->where('key', $key)->first();
        if (! $task instanceof ScheduledTask) {
            throw new InvalidArgumentException("Unknown scheduled task [{$key}].");
        }

        return $task;
    }
}
