<?php

namespace App\Support;

use App\Models\ConceptTerm;
use Illuminate\Support\Arr;

final class ConceptSeed
{
    /**
     * One random default-locale term, else a config default_seed, else creativity.
     */
    public static function randomTerm(): string
    {
        $fromDb = self::randomDefaultLocaleTerms(1);
        $term = $fromDb[0] ?? null;
        if ($term !== null && $term !== '') {
            return $term;
        }

        return self::fromConfigDefaults(1, normalize: false)[0];
    }

    /**
     * Up to $n random default-locale terms, else config default_seeds, else creativity.
     *
     * @return list<string>
     */
    public static function randomTerms(int $n): array
    {
        $fromDb = self::randomDefaultLocaleTerms($n);
        if (count($fromDb) > 0) {
            return array_values(array_unique($fromDb));
        }

        return self::fromConfigDefaults($n, normalize: true);
    }

    /**
     * @return list<string>
     */
    private static function randomDefaultLocaleTerms(int $n): array
    {
        $n = max(1, $n);
        $locale = (string) config('concepts.default_locale', 'en');

        return array_values(array_map(
            'strval',
            ConceptTerm::query()
                ->where('locale', $locale)
                ->inRandomOrder()
                ->limit($n)
                ->pluck('term')
                ->all()
        ));
    }

    /**
     * @return list<string>
     */
    private static function fromConfigDefaults(int $n, bool $normalize): array
    {
        $n = max(1, $n);
        $defaults = config('concepts.default_seeds', []);

        if (! is_array($defaults) || $defaults === []) {
            return ['creativity'];
        }

        $picked = [];
        for ($i = 0; $i < $n; $i++) {
            $picked[] = (string) Arr::random($defaults);
        }

        if (! $normalize) {
            return $picked;
        }

        $picked = array_map(fn (string $s) => ConceptTerm::normalizeTerm($s), $picked);

        return array_values(array_unique($picked));
    }
}
