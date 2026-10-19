<?php

namespace App\Filament\Resources\ScheduledTasks;

use App\Filament\Resources\ScheduledTasks\Pages\EditScheduledTask;
use App\Filament\Resources\ScheduledTasks\Pages\ListScheduledTasks;
use App\Filament\Resources\ScheduledTasks\RelationManagers\RunsRelationManager;
use App\Filament\Resources\ScheduledTasks\Schemas\ScheduledTaskForm;
use App\Filament\Resources\ScheduledTasks\Tables\ScheduledTasksTable;
use App\Models\ScheduledTask;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class ScheduledTaskResource extends Resource
{
    protected static ?string $model = ScheduledTask::class;

    protected static string|\UnitEnum|null $navigationGroup = 'Settings';

    protected static ?string $modelLabel = 'Scheduled task';

    protected static ?string $pluralModelLabel = 'Scheduled tasks';

    protected static ?string $navigationLabel = 'Scheduled tasks';

    protected static ?int $navigationSort = 90;

    protected static ?string $slug = 'scheduled-tasks';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedClock;

    public static function form(Schema $schema): Schema
    {
        return ScheduledTaskForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return ScheduledTasksTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            RunsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListScheduledTasks::route('/'),
            'edit' => EditScheduledTask::route('/{record}/edit'),
        ];
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function canDeleteAny(): bool
    {
        return false;
    }
}
