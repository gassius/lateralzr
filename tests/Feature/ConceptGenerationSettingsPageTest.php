<?php

namespace Tests\Feature;

use App\Filament\Pages\ConceptGenerationSettingsPage;
use App\Services\ConceptGenerationSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Feature\Concerns\InteractsWithFilamentAdmin;
use Tests\TestCase;

class ConceptGenerationSettingsPageTest extends TestCase
{
    use InteractsWithFilamentAdmin;
    use RefreshDatabase;

    public function test_defaults_to_config_band(): void
    {
        $this->actingAsAdmin();

        $this->get('/admin/concept-generation-settings')->assertSuccessful();

        Livewire::test(ConceptGenerationSettingsPage::class)
            ->assertSuccessful()
            ->assertFormSet([
                'laterality_band_min' => 0.4,
                'laterality_band_max' => 0.6,
            ]);
    }

    public function test_saves_band_to_app_settings(): void
    {
        $this->actingAsAdmin();

        Livewire::test(ConceptGenerationSettingsPage::class)
            ->fillForm([
                'laterality_band_min' => 0.3,
                'laterality_band_max' => 0.7,
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $band = app(ConceptGenerationSettings::class)->band();
        $this->assertEqualsWithDelta(0.3, $band['min'], 0.001);
        $this->assertEqualsWithDelta(0.7, $band['max'], 0.001);
        $this->assertDatabaseHas('app_settings', ['key' => 'laterality_band_min']);
        $this->assertDatabaseHas('app_settings', ['key' => 'laterality_band_max']);
    }
}
