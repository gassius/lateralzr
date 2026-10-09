<?php

namespace Tests\Unit;

use App\Jobs\CompleteConceptInfoBatchJob;
use App\Jobs\LocalizeConceptBatchJob;
use ReflectionClass;
use Tests\TestCase;

class DeferredBatchFollowUpCapStatusTest extends TestCase
{
    public function test_both_jobs_use_the_trait_partial_depth_cap_status(): void
    {
        $completeMethod = (new ReflectionClass(CompleteConceptInfoBatchJob::class))->getMethod('deferredCapStatus');
        $localizeMethod = (new ReflectionClass(LocalizeConceptBatchJob::class))->getMethod('deferredCapStatus');

        $completeJob = new CompleteConceptInfoBatchJob(
            termIds: [1],
            mode: 'both',
            runUuid: null,
            jobKey: 'complete-info#1',
        );
        $localizeJob = new LocalizeConceptBatchJob(
            conceptIds: [1],
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            provider: null,
            model: null,
            runUuid: null,
            jobKey: 'localize#1',
        );

        $this->assertSame('partial', $completeMethod->invoke($completeJob));
        $this->assertSame('partial', $localizeMethod->invoke($localizeJob));
    }
}
