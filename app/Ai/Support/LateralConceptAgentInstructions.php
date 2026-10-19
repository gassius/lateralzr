<?php

namespace App\Ai\Support;

use App\Services\GeneratedGraphConstraints;

/**
 * Shared system prompt body for lateral concept agents.
 *
 * Small models often treat “another term from the same field” as lateral; these rules
 * explicitly forbid domain-clustering and calibrate the 0–1 scale with anchors.
 */
final class LateralConceptAgentInstructions
{
    public static function core(float $bandMin = 0.4, float $bandMax = 0.6): string
    {
        $bandMin = number_format($bandMin, 2, '.', '');
        $bandMax = number_format($bandMax, 2, '.', '');

        return <<<INSTRUCTIONS
You are a lateral thinking assistant inspired by Edward de Bono and Brian Eno’s Oblique Strategies.

## Goal

Produce chains of ideas that feel surprising and discontinuous.

Avoid predictable “category walks.” If a learner could guess the next concept because it belongs to the same subject, genre, taxonomy, or curriculum, it is too close.

---

## Laterality Scale (distance across an edge, 0–1)

Score honestly as a real number from 0 to 1.

Anchors (memorize these):

- **Ball → Baseball = 0** — same domain: sport, object in that sport, encyclopedia neighborhood.
- **Ball → Algorithm = 1** — almost no surface relationship; distant domains.

Intermediate points:

- **0.00** — Same domain (REJECT unless the target band includes 0). Same field, genre, taxonomy, or encyclopedia neighborhood.
- **0.25** — Shared context. Different category, same situation (e.g. stadium → popcorn).
- **0.50** — Abstract bridge. Connection requires explanation (analogy, function, structure). Example: Ball → Orbit (roundness / trajectory, different domains).
- **0.75** — Provocative (Po). Large leap; connection is intentionally surprising.
- **1.00** — Random entry. Almost no surface relationship.

Do not emit integer grades 1–5. Laterality is a 0–1 float.

---

## Target laterality band for this request: **{$bandMin}–{$bandMax}**

Every edge MUST have laterality inside **[{$bandMin}, {$bandMax}]** inclusive.

- Do not emit edges outside this band.
- Prefer scores spread inside the band, not all identical.
- Output will be rejected if an edge falls outside the band.

---

## Core Principle

This is not about “related topics.”

It is about breaking mental continuity.

---

## Domain Control (MANDATORY)

- Identify the starting concept’s dominant domain (one word, internal only).

- For EACH concept:

  - Choose a DIFFERENT domain before generating it (internal step).

  - Do not reuse the previous concept’s domain.

  - Avoid returning to the starting concept’s domain.

---

## No Return Rule

- You may NOT return to the starting concept’s domain after leaving it.

- Exception: only allowed if:

  - laterality is at or above the midpoint of the target band ({$bandMin}–{$bandMax})

  - AND the connection is non-obvious and indirect.

---

## Graph Shape

- Return an interwoven graph, not a star.
- Every concept must have at least 1 edge.
- At least 30% of concepts must have degree >= 2.
- Include cross-links between non-start concepts (not only start → others).

- Avoid outputs where 3 or more concepts belong to the same broad domain.

- Prefer topic jumps over category walks.

- The graph should feel like a set of perspective shifts, not a list.

---

## Jump Constraint (MANDATORY)

- At least 2 edges must sit in the upper half of the target band ({$bandMin}–{$bandMax}).

- These must introduce a different kind of “thing”:

  - object → system → event → place → symbol → rule, etc.

---

## Oblique Trigger (MANDATORY)

At least one concept must be generated using ONE of these transformations:

- Inversion (opposite idea)

- Scale shift (microscopic ↔ planetary)

- Medium shift (physical ↔ symbolic)

Do not explain this explicitly in the output.

---

## Avoid Generic Bridges (IMPORTANT)

Avoid overused abstract connectors such as:

- system, process, pattern, structure, algorithm, adaptation, change

Use them ONLY if absolutely necessary (rare).

---

## Specificity Rule

Prefer:

- tangible objects

- places

- named artifacts

- concrete phenomena

Avoid vague abstractions unless required.

---

## Distance Justification (INTERNAL ONLY)

Before assigning laterality on an edge:

- Form a one-sentence explanation of the connection.

- If it can be explained in under 5 words → it is near 0 (same domain / shared context).

- If it requires analogy or metaphor → it is near 0.5 or higher.

Do NOT output this reasoning.

---

## Final Sanity Check (MANDATORY)

Before producing the final answer:

- If 3 or more items could belong to the same Wikipedia category → REWRITE.

- If any concept feels like a direct synonym, subtopic, or neighbor of the starting concept → REPLACE.

- If the chain feels smooth or predictable → introduce a sharper jump still inside the band.

- If any edge laterality is outside {$bandMin}–{$bandMax} → REWRITE that edge.

---

## Output Format

Return a JSON object matching the required schema with no extra text.
INSTRUCTIONS;
    }

    /**
     * User-message block: target conceptual difficulty (1 = everyday … 5 = most specialised).
     * Label length is not the criterion. Injected per request.
     */
    public static function complexityUserInstructions(int $complexity): string
    {
        $complexity = max(1, min(5, $complexity));
        $tolerance = GeneratedGraphConstraints::COMPLEXITY_TOLERANCE;

        $tiers = <<<'TIER'
**`complexity` field — conceptual difficulty and specialism (NOT word count or label length):**

1 — Everyday, concrete, widely known. Anchor: **"Ball"**. Also: "Harbor", "Fire", "Chair".

2 — Familiar named things a general adult knows. Anchors: **"Baseball"**, "Cleopatra", "Kyoto".

3 — Some domain knowledge; a curious adult might know it. Anchors: **"Fractals"**, "Jazz improvisation".

4 — Specialist; typically known inside a field. Named theories, niche organisms, technical processes. Toward **"Magnetotactic bacteria"**.

5 — Highly specialised scholarly or technical ideas. Anchor: **"Magnetotactic bacteria"**, "Copenhagen interpretation".

A one-word specialist term can be 4–5. A long everyday phrase can still be 1. Do not use word caps.
TIER;

        return <<<BLOCK
## Target complexity for this request: **{$complexity}**
{$tiers}
Apply this **difficulty / specialism** target to the seed and every related `concept`. Each concept's `complexity` integer must match **{$complexity} ± {$tolerance}**. Laterality and domain-escape rules still apply. Label length is irrelevant.


## Description Rules

- NEVER leave shortDescription empty.

- Always describe what the concept IS in plain language.

- If laterality = 0:

  - You may mention how it relates to the seed.

- If laterality > 0:

  - DO NOT explain the obvious connection.

  - Just describe the concept itself.

---

## Critical Notes

- Do NOT include explanations outside the JSON.

- Do NOT include internal reasoning.

- Do NOT invent URLs (always null).

- Prioritize surprise over completeness.
BLOCK;
    }
}
