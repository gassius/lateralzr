<?php

namespace App\Filament\Resources\ConceptRelationships;

use App\Filament\Resources\ConceptRelationships\Pages\EditConceptRelationship;
use App\Filament\Resources\ConceptRelationships\Pages\ListConceptRelationships;
use App\Filament\Resources\ConceptRelationships\RelationManagers\EvidencesRelationManager;
use App\Filament\Resources\ConceptRelationships\RelationManagers\FeedbackRelationManager;
use App\Filament\Resources\ConceptRelationships\Schemas\ConceptRelationshipForm;
use App\Filament\Resources\ConceptRelationships\Tables\ConceptRelationshipsTable;
use App\Models\ConceptRelationship;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class ConceptRelationshipResource extends Resource
{
    protected static ?string $model = ConceptRelationship::class;

    protected static string|\UnitEnum|null $navigationGroup = 'Data';

    protected static ?string $modelLabel = 'Concept Relationship';

    protected static ?string $pluralModelLabel = 'Concept Relationships';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedShare;

    public static function form(Schema $schema): Schema
    {
        return ConceptRelationshipForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return ConceptRelationshipsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            EvidencesRelationManager::class,
            FeedbackRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListConceptRelationships::route('/'),
            'edit' => EditConceptRelationship::route('/{record}/edit'),
        ];
    }
}

