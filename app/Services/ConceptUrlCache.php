<?php

namespace App\Services;

use App\Models\ConceptUrl;
use Illuminate\Support\Facades\Log;

class ConceptUrlCache
{
    /**
     * Find a concept URL record by normalized concept name.
     */
    public function findByConcept(string $concept): ?ConceptUrl
    {
        $normalized = ConceptUrl::normalizeConcept($concept);

        return ConceptUrl::query()->where('concept', $normalized)->first();
    }

    /**
     * Find or create a concept URL record; update URLs if provided.
     */
    public function remember(string $concept, ?string $wikiUrl, ?string $mediaUrl): ConceptUrl
    {
        $normalized = ConceptUrl::normalizeConcept($concept);

        $record = ConceptUrl::query()->where('concept', $normalized)->first();

        if ($record) {
            $updated = false;
            if ($wikiUrl !== null && $record->wiki_url !== $wikiUrl) {
                $record->wiki_url = $wikiUrl;
                $updated = true;
            }
            if ($mediaUrl !== null && $record->media_url !== $mediaUrl) {
                $record->media_url = $mediaUrl;
                $updated = true;
            }
            if ($updated) {
                $record->save();
            }

            return $record;
        }

        $record = ConceptUrl::query()->create([
            'concept' => $normalized,
            'wiki_url' => $wikiUrl,
            'media_url' => $mediaUrl,
        ]);

        Log::info('ConceptUrlCache: created new record', ['concept' => $normalized]);

        return $record;
    }
}
