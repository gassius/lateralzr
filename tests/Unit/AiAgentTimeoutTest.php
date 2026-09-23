<?php

namespace Tests\Unit;

use App\Ai\Agents\ConceptLocalizeAgent;
use App\Ai\Agents\ConceptsOnlyAgent;
use App\Jobs\CompleteConceptInfoBatchJob;
use App\Jobs\GenerateConceptGraphJob;
use App\Jobs\LocalizeConceptBatchJob;
use Laravel\Ai\Attributes\Timeout;
use ReflectionClass;
use Tests\TestCase;

class AiAgentTimeoutTest extends TestCase
{
    public function test_llm_agent_http_timeouts_sit_under_the_300s_job_limit(): void
    {
        $graphHttp = $this->timeoutSeconds(ConceptsOnlyAgent::class);
        $localizeHttp = $this->timeoutSeconds(ConceptLocalizeAgent::class);

        $this->assertSame(210, $graphHttp);
        $this->assertSame(180, $localizeHttp);
        $this->assertGreaterThanOrEqual(90, 300 - $graphHttp);
        $this->assertGreaterThanOrEqual(90, 300 - $localizeHttp);
    }

    public function test_queue_jobs_share_timeout_and_spaced_backoff(): void
    {
        $graph = new GenerateConceptGraphJob('seed', 10, 2, 'openrouter', 'openai/gpt-4o-mini', null);
        $localize = new LocalizeConceptBatchJob([1], 'en', 'es', true, 'openrouter', 'openai/gpt-4o-mini', null, 'localize#1');
        $complete = new CompleteConceptInfoBatchJob([1], 'both', null, 'complete-info#1');

        foreach ([$graph, $localize, $complete] as $job) {
            $this->assertSame(300, $job->timeout);
            $this->assertSame(3, $job->tries);
            $this->assertSame([30, 90], $job->backoff());
        }
    }

    /**
     * @param  class-string  $agent
     */
    private function timeoutSeconds(string $agent): int
    {
        $attributes = (new ReflectionClass($agent))->getAttributes(Timeout::class);
        $this->assertNotEmpty($attributes, $agent.' is missing #[Timeout]');

        return (int) $attributes[0]->getArguments()[0];
    }
}
