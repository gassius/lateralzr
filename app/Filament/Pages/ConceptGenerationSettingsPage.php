<?php

namespace App\Filament\Pages;

use App\Services\ConceptGenerationSettings;
use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Actions;
use Filament\Schemas\Components\EmbeddedSchema;
use Filament\Schemas\Components\Form;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;

/**
 * @property-read Schema $form
 */
class ConceptGenerationSettingsPage extends Page
{
    protected static string|\UnitEnum|null $navigationGroup = 'Settings';

    protected static ?string $navigationLabel = 'Generation settings';

    protected static ?string $title = 'Concept generation settings';

    protected static string|\BackedEnum|null $navigationIcon = Heroicon::OutlinedCog6Tooth;

    protected static ?int $navigationSort = 80;

    protected static ?string $slug = 'concept-generation-settings';

    /**
     * @var array<string, mixed>|null
     */
    public ?array $data = [];

    public function mount(): void
    {
        $settings = app(ConceptGenerationSettings::class);
        $band = $settings->band();

        $this->form->fill([
            'laterality_band_min' => $band['min'],
            'laterality_band_max' => $band['max'],
        ]);
    }

    public function defaultForm(Schema $schema): Schema
    {
        return $schema
            ->statePath('data');
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Laterality band')
                    ->description('Generated edges must score inside this 0–1 band. Ball–Baseball = 0, Ball–Algorithm = 1. Default 0.4–0.6.')
                    ->schema([
                        TextInput::make('laterality_band_min')
                            ->label('Minimum laterality')
                            ->numeric()
                            ->minValue(0)
                            ->maxValue(1)
                            ->step(0.01)
                            ->required(),
                        TextInput::make('laterality_band_max')
                            ->label('Maximum laterality')
                            ->numeric()
                            ->minValue(0)
                            ->maxValue(1)
                            ->step(0.01)
                            ->required()
                            ->gte('laterality_band_min'),
                    ])
                    ->columns(2),
            ]);
    }

    public function content(Schema $schema): Schema
    {
        return $schema
            ->components([
                Form::make([EmbeddedSchema::make('form')])
                    ->id('form')
                    ->livewireSubmitHandler('save')
                    ->footer([
                        Actions::make([
                            Action::make('save')
                                ->label('Save')
                                ->submit('save')
                                ->keyBindings(['mod+s']),
                        ]),
                    ]),
            ]);
    }

    public function save(): void
    {
        $data = $this->form->getState();
        $min = (float) ($data['laterality_band_min'] ?? 0.4);
        $max = (float) ($data['laterality_band_max'] ?? 0.6);

        app(ConceptGenerationSettings::class)->setBand($min, $max);

        Notification::make()
            ->title('Generation settings saved')
            ->success()
            ->send();
    }
}
