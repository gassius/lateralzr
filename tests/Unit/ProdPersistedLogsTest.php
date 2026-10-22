<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ProdPersistedLogsTest extends TestCase
{
    public function test_compose_logs_every_service_with_rotated_json_file(): void
    {
        $yml = (string) file_get_contents(dirname(__DIR__, 2).'/docker-compose.prod.yml');

        foreach (['nginx:', 'app:', 'queue:', 'scheduler:'] as $service) {
            $this->assertStringContainsString($service, $yml);
        }

        $this->assertSame(4, preg_match_all('/^    logging: \*default-logging$/m', $yml));
        $this->assertStringContainsString('driver: json-file', $yml);
        $this->assertStringContainsString('max-size: "10m"', $yml);
        $this->assertStringContainsString('max-file: "3"', $yml);
        $this->assertStringContainsString('${LATERALZR_STORAGE:-./storage}/../logs:/var/log/lateralzr-host', $yml);
        $this->assertStringContainsString('${LATERALZR_STORAGE:-./storage}/../logs/nginx:/var/log/nginx', $yml);
        $this->assertStringContainsString('/var/www/html/bin/tee-service-log.sh', $yml);
        $this->assertStringContainsString('/var/log/lateralzr-host/queue/queue.log', $yml);
        $this->assertStringContainsString('/var/log/lateralzr-host/scheduler/scheduler.log', $yml);
        $this->assertStringNotContainsString("\n  db:", $yml);
        $this->assertStringNotContainsString("\n  mysql:", $yml);
    }

    public function test_deploy_prod_creates_log_dirs_and_app_symlink(): void
    {
        $script = (string) file_get_contents(dirname(__DIR__, 2).'/bin/deploy-prod');

        $this->assertStringContainsString('logs-host', $script);
        $this->assertStringContainsString('${logs_host}/nginx', $script);
        $this->assertStringContainsString('${logs_host}/queue', $script);
        $this->assertStringContainsString('${logs_host}/scheduler', $script);
        $this->assertStringContainsString('ln -sfn', $script);
        $this->assertStringContainsString('chown -R 33:33', $script);
        $this->assertStringContainsString('chown -R 101:101', $script);
        $this->assertStringContainsString('rotate-prod-logs', $script);
    }

    public function test_nginx_writes_access_and_error_to_files_and_stdout(): void
    {
        $conf = (string) file_get_contents(dirname(__DIR__, 2).'/docker/nginx/prod.conf');

        $this->assertStringContainsString('access_log /var/log/nginx/access.log;', $conf);
        $this->assertStringContainsString('access_log /dev/stdout;', $conf);
        $this->assertStringContainsString('error_log /var/log/nginx/error.log;', $conf);
        $this->assertStringContainsString('error_log /dev/stderr;', $conf);
    }

    public function test_logging_config_promotes_single_to_daily(): void
    {
        $contents = (string) file_get_contents(dirname(__DIR__, 2).'/config/logging.php');

        $this->assertStringContainsString("env('LOG_STACK', 'daily')", $contents);
        $this->assertStringContainsString("\$channel === 'single' ? 'daily' : \$channel", $contents);
        $this->assertStringContainsString("in_array('daily'", $contents);
        $this->assertStringContainsString("in_array('stderr'", $contents);
    }

    public function test_rotate_prod_logs_rotates_oversized_service_files(): void
    {
        $root = sys_get_temp_dir().'/lateralzr-rotate-logs-'.uniqid('', true);
        mkdir($root.'/nginx', 0777, true);
        mkdir($root.'/queue', 0777, true);
        mkdir($root.'/scheduler', 0777, true);

        file_put_contents($root.'/nginx/access.log', str_repeat('a', 200));
        file_put_contents($root.'/queue/queue.log', str_repeat('b', 50));
        file_put_contents($root.'/scheduler/scheduler.log', str_repeat('c', 200));
        file_put_contents($root.'/queue/laravel-2026-10-22.log', str_repeat('d', 200));

        $script = dirname(__DIR__, 2).'/bin/rotate-prod-logs';
        $this->assertFileIsReadable($script);

        $command = sprintf(
            'LATERALZR_LOGS_ROOT=%s LATERALZR_LOG_MAX_BYTES=100 %s',
            escapeshellarg($root),
            escapeshellarg($script)
        );
        exec($command, $output, $code);
        $this->assertSame(0, $code, implode("\n", $output));

        $this->assertFileExists($root.'/nginx/access.log.1');
        $this->assertFileExists($root.'/scheduler/scheduler.log.1');
        $this->assertFileDoesNotExist($root.'/queue/queue.log.1');
        $this->assertFileDoesNotExist($root.'/queue/laravel-2026-10-22.log.1');
        $this->assertSame(200, strlen((string) file_get_contents($root.'/queue/laravel-2026-10-22.log')));
        $this->assertSame('', file_get_contents($root.'/nginx/access.log'));

        $this->removeTree($root);
    }

    public function test_logs_host_is_parent_of_storage_plus_logs(): void
    {
        $root = sys_get_temp_dir().'/lateralzr-logs-host-'.uniqid('', true);
        mkdir($root.'/bin', 0777, true);
        foreach (['storage-host', 'logs-host'] as $name) {
            $source = dirname(__DIR__, 2).'/bin/'.$name;
            $this->assertTrue(copy($source, $root.'/bin/'.$name));
            chmod($root.'/bin/'.$name, 0755);
        }

        $command = [
            'env',
            '-u',
            'LATERALZR_STORAGE',
            $root.'/bin/logs-host',
        ];
        $spec = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $process = proc_open($command, $spec, $pipes, $root);
        $this->assertIsResource($process);
        $stdout = trim((string) stream_get_contents($pipes[1]));
        fclose($pipes[1]);
        fclose($pipes[2]);
        $code = proc_close($process);

        $this->assertSame(0, $code);
        $this->assertSame('./logs', $stdout);

        $command = ['env', 'LATERALZR_STORAGE=/mnt/data/lateralzr/storage', $root.'/bin/logs-host'];
        $process = proc_open($command, $spec, $pipes, $root);
        $this->assertIsResource($process);
        $stdout = trim((string) stream_get_contents($pipes[1]));
        fclose($pipes[1]);
        fclose($pipes[2]);
        $code = proc_close($process);

        $this->assertSame(0, $code);
        $this->assertSame('/mnt/data/lateralzr/logs', $stdout);

        $this->removeTree($root);
    }

    private function removeTree(string $path): void
    {
        if (! is_dir($path)) {
            return;
        }
        $items = scandir($path);
        if ($items === false) {
            return;
        }
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $full = $path.DIRECTORY_SEPARATOR.$item;
            if (is_dir($full)) {
                $this->removeTree($full);
            } else {
                unlink($full);
            }
        }
        rmdir($path);
    }
}
