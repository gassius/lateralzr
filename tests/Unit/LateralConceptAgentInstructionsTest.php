<?php

namespace Tests\Unit;

use App\Ai\Agents\ConceptsOnlyAgent;
use App\Ai\Support\LateralConceptAgentInstructions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LateralConceptAgentInstructionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_core_prompt_contains_anchors_and_band(): void
    {
        $text = LateralConceptAgentInstructions::core(0.4, 0.6);

        $this->assertStringContainsString('Ball → Baseball = 0', $text);
        $this->assertStringContainsString('Ball → Algorithm = 1', $text);
        $this->assertStringContainsString('0.40–0.60', $text);
        $this->assertStringContainsString('0–1', $text);
        $this->assertStringNotContainsString('1 — Same domain', $text);
    }

    public function test_complexity_rubric_has_no_word_caps(): void
    {
        $text = LateralConceptAgentInstructions::complexityUserInstructions(3);

        $this->assertStringContainsString('Target complexity for this request: **3**', $text);
        $this->assertStringContainsString('Ball', $text);
        $this->assertStringContainsString('Magnetotactic bacteria', $text);
        $this->assertStringContainsString('NOT word count', $text);
        $this->assertStringNotContainsString('word-count caps', $text);
        $this->assertStringNotContainsString('At most 2 words', $text);
        $this->assertStringNotContainsString('At most 3 words', $text);
        $this->assertStringNotContainsString('Single word.', $text);
    }

    public function test_concepts_only_agent_instructions_include_configured_band(): void
    {
        config([
            'concepts.laterality_band_min' => 0.4,
            'concepts.laterality_band_max' => 0.6,
        ]);

        $text = (string) (new ConceptsOnlyAgent)->instructions();

        $this->assertStringContainsString('Ball → Baseball = 0', $text);
        $this->assertStringContainsString('Ball → Algorithm = 1', $text);
        $this->assertStringContainsString('0.40–0.60', $text);
        $this->assertStringContainsString('number, 0–1', $text);
        $this->assertStringNotContainsString('integer, 1–5): Distance', $text);
    }
}
