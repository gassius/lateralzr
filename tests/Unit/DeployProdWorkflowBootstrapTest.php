<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class DeployProdWorkflowBootstrapTest extends TestCase
{
    public function test_deploy_step_updates_checkout_before_calling_new_scripts(): void
    {
        $yml = file_get_contents(dirname(__DIR__, 2).'/.github/workflows/deploy-prod.yml');
        $this->assertNotFalse($yml);

        $fetch = strpos($yml, 'git fetch origin main');
        $merge = strpos($yml, 'git merge --ff-only origin/main');
        $ssh = strpos($yml, './bin/deploy-prod-ssh');
        $verify = strpos($yml, './bin/deploy-prod-verify');

        $this->assertNotFalse($fetch, 'Deploy step must fetch origin main');
        $this->assertNotFalse($merge, 'Deploy step must fast-forward to origin/main');
        $this->assertNotFalse($ssh, 'Deploy step must call deploy-prod-ssh after the update');
        $this->assertNotFalse($verify, 'Verify step must call deploy-prod-verify');

        $this->assertLessThan($merge, $fetch, 'fetch must run before merge');
        $this->assertLessThan($ssh, $merge, 'merge must run before deploy-prod-ssh');
        $this->assertLessThan($verify, $ssh, 'verify must run after the deploy script is invoked');

        $this->assertStringContainsString('set -euo pipefail', $yml);
        $this->assertStringContainsString('PROD_PATH must be an absolute path without a leading tilde', $yml);
        $this->assertStringContainsString('python3 is required on the deploy host', $yml);
        $this->assertStringContainsString('bin/deploy-prod-ssh missing after fast-forward', $yml);
        $this->assertStringNotContainsString('else ./bin/deploy-prod', $yml);
    }
}
