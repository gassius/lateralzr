<?php

namespace App\Http\Controllers\Api;

use App\Services\ConceptRelationshipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ConceptRelationshipController
{
    public function __construct(
        protected ConceptRelationshipService $service
    ) {
    }

    /**
     * Generate laterally related concepts from a seed concept.
     * When seed is omitted, the API chooses a random concept (cold start).
     *
     * @param  Request  $request
     * @return JsonResponse
     *
     * @throws ValidationException
     */
    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'seed' => ['sometimes', 'nullable', 'string', 'min:1', 'max:255'],
            'count' => ['sometimes', 'integer', 'min:1', 'max:10'],
        ]);

        $seed = isset($validated['seed']) && trim((string) $validated['seed']) !== ''
            ? trim((string) $validated['seed'])
            : null;

        try {
            $result = $this->service->generateRelationships(
                seedConcept: $seed,
                count: $validated['count'] ?? null
            );

            return response()->json([
                'data' => $result,
                'status' => 'success',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to generate concept relationships: '.$e->getMessage(),
                'status' => 'error',
            ], 500);
        }
    }
}
