<?php

namespace App\Services\Enrichment;

/**
 * Picks a Wikipedia article for a concept label.
 *
 * Exact titles are not enough ("giza solar boat" is not the article title).
 * Search hits whose titles add a container word (museum, list, …) that the
 * concept never used are dropped, then the description is used to rank the rest.
 * With no description, earlier search rank wins: the engine already linked the phrase.
 */
final class WikipediaCandidateRanker
{
    /** @var list<string> */
    private const STOP = [
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'for', 'with',
        'that', 'this', 'it', 'as', 'be', 'by', 'or', 'and', 'from', 'into', 'its', 'their', 'his',
        'her', 'than', 'then', 'also', 'which', 'who', 'whom', 'whose', 'about', 'over', 'after',
        'before', 'during', 'between', 'under', 'above', 'such', 'not', 'no', 'yes', 'one', 'two',
        'un', 'una', 'el', 'la', 'los', 'las', 'de', 'del', 'al', 'y', 'en', 'por', 'para', 'con',
        'que', 'es', 'son', 'fue', 'ser', 'se', 'su', 'sus', 'lo', 'como', 'mas', 'más', 'este',
        'esta', 'esto', 'ese', 'esa', 'si', 'ya', 'muy', 'entre', 'sobre', 'tras', 'desde', 'hasta',
        'cuando', 'donde', 'dónde',
    ];

    /** @var list<string> */
    private const CONTAINERS = [
        'museum', 'museo', 'list', 'lista', 'disambiguation', 'timeline', 'glossary', 'glosario',
        'outline', 'index', 'indice', 'índice', 'category', 'categoria', 'categoría',
    ];

    /**
     * @param  list<array{title:string,extract:string,rank:int,disambiguation:bool}>  $candidates
     * @return array{title:string,extract:string,rank:int,disambiguation:bool}|null
     */
    public function best(string $label, string $description, array $candidates): ?array
    {
        $labelTokens = $this->tokens($label);
        $contextTokens = $this->tokens(trim($label.' '.$description));
        $kept = [];

        foreach ($candidates as $candidate) {
            if (($candidate['disambiguation'] ?? false) === true) {
                continue;
            }

            $titleTokens = $this->tokens((string) ($candidate['title'] ?? ''));
            $extraContainer = false;
            foreach ($titleTokens as $token) {
                if (in_array($token, self::CONTAINERS, true) && ! $this->covered($token, $contextTokens)) {
                    $extraContainer = true;
                    break;
                }
            }
            if ($extraContainer) {
                continue;
            }

            $body = array_merge($titleTokens, $this->tokens((string) ($candidate['extract'] ?? '')));
            if ($labelTokens !== [] && ! $this->anyCovered($labelTokens, $body)) {
                continue;
            }

            $kept[] = $candidate;
        }

        if ($kept === []) {
            return null;
        }

        usort($kept, function (array $a, array $b) use ($label, $description): int {
            $scoreA = $this->score($label, $description, $a);
            $scoreB = $this->score($label, $description, $b);
            if (abs($scoreA - $scoreB) > 0.04) {
                return $scoreB <=> $scoreA;
            }

            return ((int) $a['rank']) <=> ((int) $b['rank']);
        });

        $winner = $kept[0];
        if ($this->score($label, $description, $winner) <= 0) {
            return null;
        }

        $descriptionTokens = $this->tokens($description);
        if ($descriptionTokens !== []) {
            $body = array_merge(
                $this->tokens((string) $winner['title']),
                $this->tokens((string) $winner['extract'])
            );
            $descriptionCoverage = $this->coverage($descriptionTokens, $body);
            $labelCoverage = $this->coverage($labelTokens, $body);
            if ($descriptionCoverage < 0.2 && $labelCoverage < 0.67) {
                return null;
            }
        }

        return $winner;
    }

    /**
     * @param  array{title:string,extract:string,rank:int,disambiguation:bool}  $candidate
     */
    public function score(string $label, string $description, array $candidate): float
    {
        $labelTokens = $this->tokens($label);
        $descriptionTokens = $this->tokens($description);
        $titleTokens = $this->tokens((string) ($candidate['title'] ?? ''));
        $body = array_merge($titleTokens, $this->tokens((string) ($candidate['extract'] ?? '')));
        $rank = max(1, (int) ($candidate['rank'] ?? 9));
        $concept = $this->coverage($labelTokens, $body);

        if ($descriptionTokens === []) {
            return (1.2 / $rank) + (0.15 * $concept);
        }

        $descriptionCoverage = $this->coverage($descriptionTokens, $body);
        $titleInDescription = $this->coverage($titleTokens, $descriptionTokens);

        return (0.85 * $descriptionCoverage) + (0.45 * $concept) + (0.25 * $titleInDescription) + (0.2 / $rank);
    }

    /**
     * @return list<string>
     */
    public function tokens(string $text): array
    {
        $lower = mb_strtolower($text);
        preg_match_all('/[\p{L}\p{N}]+/u', $lower, $matches);
        $tokens = [];
        foreach ($matches[0] as $token) {
            if (mb_strlen($token) <= 2 || in_array($token, self::STOP, true)) {
                continue;
            }
            $tokens[$token] = true;
        }

        return array_keys($tokens);
    }

    /**
     * @param  list<string>  $needles
     * @param  list<string>  $haystack
     */
    private function coverage(array $needles, array $haystack): float
    {
        if ($needles === []) {
            return 0.0;
        }

        $hits = 0;
        foreach ($needles as $needle) {
            if ($this->covered($needle, $haystack)) {
                $hits++;
            }
        }

        return $hits / count($needles);
    }

    /**
     * @param  list<string>  $needles
     * @param  list<string>  $haystack
     */
    private function anyCovered(array $needles, array $haystack): bool
    {
        foreach ($needles as $needle) {
            if ($this->covered($needle, $haystack)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<string>  $haystack
     */
    private function covered(string $needle, array $haystack): bool
    {
        foreach ($haystack as $token) {
            if ($needle === $token) {
                return true;
            }
            $short = mb_strlen($needle) <= mb_strlen($token) ? $needle : $token;
            $long = $short === $needle ? $token : $needle;
            if (mb_strlen($short) >= 4 && str_starts_with($long, $short)) {
                return true;
            }
        }

        return false;
    }
}
