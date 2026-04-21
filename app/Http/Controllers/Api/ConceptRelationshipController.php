<?php

namespace App\Http\Controllers\Api;

use App\Services\ConceptGraphQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ConceptRelationshipController
{
    public function __construct(
        protected ConceptGraphQuery $query
    ) {}

    /**
     * Generate laterally related concepts from a seed concept.
     * When seed is omitted, the API chooses a random concept (cold start).
     *
     *
     * @throws ValidationException
     */
    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'seed' => ['sometimes', 'nullable', 'string', 'min:1', 'max:255'],
            'count' => ['sometimes', 'integer', 'min:1', 'max:10'],
            'complexity' => ['sometimes', 'integer', 'min:1', 'max:5'],
        ]);

        $seed = isset($validated['seed']) && trim((string) $validated['seed']) !== ''
            ? trim((string) $validated['seed'])
            : null;

        try {
            $complexity = $validated['complexity'] ?? null;
            $complexity = $complexity !== null ? (int) $complexity : (int) config('concepts.default_complexity', 2);

            $result = $this->query->getFromDb(
                seedConcept: $seed,
                count: $validated['count'] ?? null,
                complexity: $complexity
            );

            if ($result === null) {
                return response()->json([
                    'message' => 'No prefetched relationships found for this seed yet.',
                    'status' => 'error',
                ], 404);
            }

            return response()->json([
                'data' => $result,
                'status' => 'success',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch concept relationships: '.$e->getMessage(),
                'status' => 'error',
            ], 500);
        }
    }
}
