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
     *
     * @param  Request  $request
     * @return JsonResponse
     *
     * @throws ValidationException
     */
    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'seed' => ['required', 'string', 'min:1', 'max:255'],
            'count' => ['sometimes', 'integer', 'min:1', 'max:10'],
        ]);

        try {
            $result = $this->service->generateRelationships(
                seedConcept: $validated['seed'],
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
