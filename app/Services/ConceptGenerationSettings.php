<?php

namespace App\Services;

use App\Models\AppSetting;
use App\Support\Laterality;

class ConceptGenerationSettings
{
    public const BAND_MIN_KEY = 'laterality_band_min';

    public const BAND_MAX_KEY = 'laterality_band_max';

    /**
     * @return array{min: float, max: float}
     */
    public function band(): array
    {
        $min = $this->bandMin();
        $max = $this->bandMax();

        if ($min > $max) {
            [$min, $max] = [$max, $min];
        }

        return ['min' => $min, 'max' => $max];
    }

    public function bandMin(): float
    {
        return $this->float(
            self::BAND_MIN_KEY,
            (float) config('concepts.laterality_band_min', 0.4)
        );
    }

    public function bandMax(): float
    {
        return $this->float(
            self::BAND_MAX_KEY,
            (float) config('concepts.laterality_band_max', 0.6)
        );
    }

    public function setBand(float $min, float $max): void
    {
        $min = Laterality::clamp($min);
        $max = Laterality::clamp($max);

        if ($min > $max) {
            [$min, $max] = [$max, $min];
        }

        $this->put(self::BAND_MIN_KEY, $min);
        $this->put(self::BAND_MAX_KEY, $max);
    }

    protected function float(string $key, float $default): float
    {
        $stored = AppSetting::query()->find($key);
        if ($stored === null || $stored->value === null || $stored->value === '') {
            return Laterality::clamp($default);
        }

        if (! is_numeric($stored->value)) {
            return Laterality::clamp($default);
        }

        return Laterality::clamp((float) $stored->value);
    }

    protected function put(string $key, float $value): void
    {
        AppSetting::query()->updateOrCreate(
            ['key' => $key],
            ['value' => (string) $value],
        );
    }
}
