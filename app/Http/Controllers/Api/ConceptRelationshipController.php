<?php

namespace App\Http\Controllers\Api;

use App\Services\ConceptGraphQuery;
use App\Support\ConceptLocale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ConceptRelationshipController
{
    public function __construct(
        protected ConceptGraphQuery $query
    ) {}

    /**
     * Fetch a graph neighborhood from prefetched concepts.
     * When start is omitted, the API chooses a random concept with edges.
     * Optional test filters: localizedConcept/canonicalConcept/onlyWithMedia.
     *
     * @throws ValidationException
     */
    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'start' => ['sometimes', 'nullable', 'string', 'min:1', 'max:255'],
            'seed' => ['sometimes', 'nullable', 'string', 'min:1', 'max:255'],
            'localizedConcept' => ['sometimes', 'nullable', 'string', 'min:1', 'max:255'],
            'canonicalStart' => ['sometimes', 'nullable', 'string', 'min:1', 'max:255'],
            'canonicalConcept' => ['sometimes', 'nullable', 'string', 'min:1', 'max:255'],
            'onlyWithMedia' => ['sometimes', 'nullable'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:500'],
            'depth' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'minStrength' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'laterality' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:5'],
            'locale' => ['sometimes', 'nullable', 'string', 'max:16', Rule::in(ConceptLocale::supported())],
            'complexity' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:5'],
        ]);

        $startValue = $validated['start'] ?? $validated['seed'] ?? $validated['localizedConcept'] ?? null;
        $start = isset($startValue) && trim((string) $startValue) !== ''
            ? trim((string) $startValue)
            : null;

        $canonicalValue = $validated['canonicalStart'] ?? $validated['canonicalConcept'] ?? null;
        $canonicalStart = isset($canonicalValue) && trim((string) $canonicalValue) !== ''
            ? trim((string) $canonicalValue)
            : null;

        $onlyWithMedia = filter_var($validated['onlyWithMedia'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $locale = ConceptLocale::resolve($validated['locale'] ?? null);
        $complexity = array_key_exists('complexity', $validated) && $validated['complexity'] !== null
            ? (int) $validated['complexity']
            : null;
        $laterality = array_key_exists('laterality', $validated) && $validated['laterality'] !== null
            ? (int) $validated['laterality']
            : null;

        try {
            $result = $this->query->getGraph(
                startConcept: $start,
                limit: (int) ($validated['limit'] ?? 100),
                depth: (int) ($validated['depth'] ?? 2),
                minStrength: (float) ($validated['minStrength'] ?? 0.0),
                locale: $locale,
                canonicalStart: $canonicalStart,
                onlyWithMedia: $onlyWithMedia,
                complexity: $complexity,
                laterality: $laterality
            );

            if ($result === null) {
                return response()->json([
                    'message' => 'No prefetched graph found for this start yet.',
                    'status' => 'error',
                ], 404);
            }

            return response()->json([
                'data' => $result,
                'status' => 'success',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch concept graph: '.$e->getMessage(),
                'status' => 'error',
            ], 500);
        }
    }
}
