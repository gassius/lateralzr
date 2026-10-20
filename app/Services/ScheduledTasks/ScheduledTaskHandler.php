<?php

namespace App\Services\ScheduledTasks;

use App\Models\ScheduledTask;

interface ScheduledTaskHandler
{
    /**
     * Enqueue work through existing pipeline/dispatch services. Must not call
     * LLM providers or Wikimedia HTTP from the scheduler process.
     *
     * @return array{items_processed: int, pipeline_run_uuid: ?string, details: array<string, mixed>}
     */
    public function handle(ScheduledTask $task): array;
}
