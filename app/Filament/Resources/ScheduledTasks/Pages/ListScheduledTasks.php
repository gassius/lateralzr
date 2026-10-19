<?php

namespace App\Filament\Resources\ScheduledTasks\Pages;

use App\Filament\Resources\ScheduledTasks\ScheduledTaskResource;
use Filament\Resources\Pages\ListRecords;

class ListScheduledTasks extends ListRecords
{
    protected static string $resource = ScheduledTaskResource::class;
}
