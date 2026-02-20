<?php

namespace App\Services;

use App\Models\Concept;
use Illuminate\Support\Facades\Log;

class ConceptUrlCache
{
    /**
     * Find a concept URL record by normalized concept name.
     */
    public function findByConcept(string $concept): ?Concept
    {
        $normalized = Concept::normalizeConcept($concept);

        return Concept::query()->where('concept', $normalized)->first();
    }

    /**
     * Find or create a concept URL record; update URLs if provided.
     */
    public function remember(string $concept, ?string $wikiUrl, ?string $mediaUrl): Concept
    {
        $normalized = Concept::normalizeConcept($concept);

        $record = Concept::query()->where('concept', $normalized)->first();

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

        $record = Concept::query()->create([
            'concept' => $normalized,
            'wiki_url' => $wikiUrl,
            'media_url' => $mediaUrl,
        ]);

        Log::info('ConceptUrlCache: created new record', ['concept' => $normalized]);

        return $record;
    }
}
