<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ProdStorageHostPathTest extends TestCase
{
    public function test_prod_compose_storage_volumes_use_env_default(): void
    {
        $compose = file_get_contents(dirname(__DIR__, 2).'/docker-compose.prod.yml');
        $this->assertNotFalse($compose);

        $this->assertSame(3, substr_count($compose, '${LATERALZR_STORAGE:-./storage}:/var/www/html/storage'));
        $this->assertSame(1, substr_count($compose, '${LATERALZR_STORAGE:-./storage}/app/public:/var/www/html/public/storage:ro'));
        $this->assertStringNotContainsString('- ./storage:/var/www/html/storage', $compose);
        $this->assertStringNotContainsString('- ./storage/app/public:', $compose);
    }

    public function test_deploy_prod_honors_lateralzr_storage_default(): void
    {
        $script = file_get_contents(dirname(__DIR__, 2).'/bin/deploy-prod');
        $this->assertNotFalse($script);
        $this->assertStringContainsString('LATERALZR_STORAGE:-./storage', $script);
        $this->assertStringContainsString('${storage_host}/app/public', $script);
    }

    public function test_github_actions_deploy_workflow_honors_lateralzr_storage(): void
    {
        $workflow = file_get_contents(dirname(__DIR__, 2).'/.github/workflows/deploy-prod.yml');
        $this->assertNotFalse($workflow);
        $this->assertStringContainsString('${LATERALZR_STORAGE:-./storage}/logs/laravel.log', $workflow);
        $this->assertStringNotContainsString('tail -n 80 storage/logs/laravel.log', $workflow);
    }
}
