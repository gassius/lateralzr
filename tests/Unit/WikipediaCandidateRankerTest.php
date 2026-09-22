<?php

namespace Tests\Unit;

use App\Services\Enrichment\WikipediaCandidateRanker;
use PHPUnit\Framework\TestCase;

class WikipediaCandidateRankerTest extends TestCase
{
    public function test_giza_solar_boat_prefers_khufu_ship_over_the_museum(): void
    {
        $ranker = new WikipediaCandidateRanker;
        $description = 'Ancient Egyptian wooden ship buried beside the Great Pyramid of Khufu at Giza, built to carry the pharaoh in the afterlife.';

        $best = $ranker->best('giza solar boat', $description, [
            [
                'title' => 'Giza Solar boat museum',
                'extract' => 'The Giza Solar boat museum was dedicated to display the reconstructed Khufu ship, a solar barque of pharaoh Khufu. It was constructed between 1961 and 1982, just a few meters from where the Khufu ship was found.',
                'rank' => 2,
                'disambiguation' => false,
            ],
            [
                'title' => 'Khufu ship',
                'extract' => 'The Khufu ship is an intact full-size solar barque from ancient Egypt. It was sealed into a pit alongside the Great Pyramid of pharaoh Khufu around 2500 BC, during the Fourth Dynasty of the ancient Egyptian Old Kingdom.',
                'rank' => 1,
                'disambiguation' => false,
            ],
            [
                'title' => 'Ancient Egyptian royal ships',
                'extract' => 'Several ancient Egyptian solar ships and boat pits were found in many ancient Egyptian sites. The most famous is the Khufu ship, which is now preserved in the Grand Egyptian Museum.',
                'rank' => 4,
                'disambiguation' => false,
            ],
            [
                'title' => 'Solar barque',
                'extract' => 'Solar barques were the vessel used by the sun god Ra in ancient Egyptian mythology.',
                'rank' => 3,
                'disambiguation' => false,
            ],
        ]);

        $this->assertNotNull($best);
        $this->assertSame('Khufu ship', $best['title']);
    }

    public function test_museum_stays_when_the_concept_itself_is_the_museum(): void
    {
        $ranker = new WikipediaCandidateRanker;
        $best = $ranker->best('giza solar boat museum', 'A museum building that displayed the Khufu ship.', [
            [
                'title' => 'Giza Solar boat museum',
                'extract' => 'The Giza Solar boat museum was dedicated to display the reconstructed Khufu ship.',
                'rank' => 1,
                'disambiguation' => false,
            ],
            [
                'title' => 'Khufu ship',
                'extract' => 'The Khufu ship is an intact full-size solar barque from ancient Egypt.',
                'rank' => 2,
                'disambiguation' => false,
            ],
        ]);

        $this->assertNotNull($best);
        $this->assertSame('Giza Solar boat museum', $best['title']);
    }

    public function test_disambiguation_pages_are_skipped(): void
    {
        $ranker = new WikipediaCandidateRanker;
        $best = $ranker->best('solar boat', '', [
            [
                'title' => 'Solar boat',
                'extract' => 'Solar boat may refer to several topics.',
                'rank' => 1,
                'disambiguation' => true,
            ],
            [
                'title' => 'Khufu ship',
                'extract' => 'The Khufu ship is an intact solar barque.',
                'rank' => 2,
                'disambiguation' => false,
            ],
        ]);

        $this->assertNotNull($best);
        $this->assertSame('Khufu ship', $best['title']);
    }
}
