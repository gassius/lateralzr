<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class DeployProdCleanupOrderTest extends TestCase
{
    public function test_deploy_prod_runs_cleanup_before_disk_check_and_after_up(): void
    {
        $script = file_get_contents(dirname(__DIR__, 2).'/bin/deploy-prod');
        $this->assertNotFalse($script);

        $beforeCleanup = strpos($script, 'run_deploy_docker_cleanup "before disk check"');
        $diskCheck = strpos($script, 'check_deploy_disk_space');
        $composeUp = strpos($script, 'up -d --remove-orphans');
        $afterCleanup = strpos($script, 'run_deploy_docker_cleanup "after compose up"');

        $this->assertNotFalse($beforeCleanup, 'deploy-prod must invoke cleanup before the disk check');
        $this->assertNotFalse($diskCheck, 'deploy-prod must still run the disk preflight');
        $this->assertNotFalse($composeUp, 'deploy-prod must still compose up');
        $this->assertNotFalse($afterCleanup, 'deploy-prod must invoke cleanup after compose up');

        $this->assertLessThan($diskCheck, $beforeCleanup, 'cleanup must run before the disk preflight');
        $this->assertLessThan($afterCleanup, $composeUp, 'post-up cleanup must run after compose up');
        $this->assertStringContainsString('deploy-cleanup-docker', $script);
    }

    public function test_cleanup_script_does_not_prune_volumes_or_all_images(): void
    {
        $script = file_get_contents(dirname(__DIR__, 2).'/bin/deploy-cleanup-docker');
        $this->assertNotFalse($script);

        $dockerCommands = [];
        foreach (explode("\n", $script) as $line) {
            $trimmed = ltrim($line);
            if (str_starts_with($trimmed, 'docker ')) {
                $dockerCommands[] = $trimmed;
            }
        }

        $joined = implode("\n", $dockerCommands);
        $this->assertStringContainsString('docker builder prune -f', $joined);
        $this->assertStringContainsString('docker image prune -f', $joined);
        $this->assertStringNotContainsString('docker volume prune', $joined);
        $this->assertStringNotContainsString('docker system prune', $joined);
        $this->assertDoesNotMatchRegularExpression('/docker image prune\s+-a/', $joined);
    }
}
