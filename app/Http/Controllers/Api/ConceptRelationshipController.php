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
     * Fetch a graph neighborhood from prefetched concepts.
     * When start is omitted, the API chooses a random concept with edges.
     *
     *
     * @throws ValidationException
     */
    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'start' => ['sometimes', 'nullable', 'string', 'min:1', 'max:255'],
            'seed' => ['sometimes', 'nullable', 'string', 'min:1', 'max:255'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:500'],
            'depth' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'minStrength' => ['sometimes', 'numeric', 'min:0', 'max:1'],
        ]);

        $startValue = $validated['start'] ?? $validated['seed'] ?? null;
        $start = isset($startValue) && trim((string) $startValue) !== ''
            ? trim((string) $startValue)
            : null;

        try {
            $result = $this->query->getGraph(
                startConcept: $start,
                limit: (int) ($validated['limit'] ?? 100),
                depth: (int) ($validated['depth'] ?? 2),
                minStrength: (float) ($validated['minStrength'] ?? 0.0)
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
