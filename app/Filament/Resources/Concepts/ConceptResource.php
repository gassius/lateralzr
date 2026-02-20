<?php

namespace App\Filament\Resources\Concepts;

use App\Filament\Resources\Concepts\Pages\CreateConcept;
use App\Filament\Resources\Concepts\Pages\EditConcept;
use App\Filament\Resources\Concepts\Pages\ListConcepts;
use App\Filament\Resources\Concepts\Schemas\ConceptForm;
use App\Filament\Resources\Concepts\Tables\ConceptsTable;
use App\Models\Concept;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class ConceptResource extends Resource
{
    protected static ?string $model = Concept::class;

    protected static string|\UnitEnum|null $navigationGroup = 'Data';

    protected static ?string $modelLabel = 'Concept';

    protected static ?string $pluralModelLabel = 'Concepts';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return ConceptForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return ConceptsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListConcepts::route('/'),
            'create' => CreateConcept::route('/create'),
            'edit' => EditConcept::route('/{record}/edit'),
        ];
    }
}
