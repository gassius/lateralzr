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
        $this->assertStringContainsString('${LATERALZR_STORAGE:-./storage}/logs/nginx:/var/log/nginx', $yml);
        $this->assertStringContainsString('/var/www/html/bin/tee-service-log.sh', $yml);
        $this->assertStringContainsString('/var/www/html/storage/logs/queue/queue.log', $yml);
        $this->assertStringContainsString('/var/www/html/storage/logs/scheduler/scheduler.log', $yml);
        $this->assertStringNotContainsString('../logs', $yml);
        $this->assertStringNotContainsString('lateralzr-host', $yml);
        $this->assertStringNotContainsString('version:', $yml);
        $this->assertStringNotContainsString("\n  db:", $yml);
        $this->assertStringNotContainsString("\n  mysql:", $yml);
    }

    public function test_deploy_prod_creates_group_writable_log_dirs_without_sudo(): void
    {
        $script = (string) file_get_contents(dirname(__DIR__, 2).'/bin/deploy-prod');

        $this->assertStringContainsString('${storage_host}/logs/nginx', $script);
        $this->assertStringContainsString('${storage_host}/logs/queue', $script);
        $this->assertStringContainsString('${storage_host}/logs/scheduler', $script);
        $this->assertStringContainsString('chmod 2775', $script);
        $this->assertStringContainsString('chmod 0664', $script);
        $this->assertStringContainsString('umask 002', $script);
        $this->assertStringContainsString('rotate-prod-logs failed; continuing deploy', $script);
        $this->assertStringContainsString('DEPLOY_PROD_REEXEC=1 exec "$SELF"', $script);
        $this->assertStringContainsString('ensure-prod-log-env', $script);
        $this->assertStringContainsString('verify-prod-daily-log', $script);
        $this->assertStringContainsString('Processing jobs|queue:work|tee-service-log', $script);
        $this->assertStringNotContainsString('sudo', $script);
        $this->assertStringNotContainsString('chown', $script);
        $this->assertStringNotContainsString('chmod 0666', $script);
        $this->assertStringNotContainsString('logs/app', $script);
        $this->assertStringNotContainsString('logrotate.conf', $script);
        $this->assertDoesNotMatchRegularExpression('/rotate-prod-logs.*\|\| true/', $script);
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
        $this->assertStringContainsString("\$defaultChannel === 'single'", $contents);
        $this->assertStringContainsString("'permission' => 0664", $contents);
        $this->assertStringContainsString("in_array('daily'", $contents);
        $this->assertStringContainsString("in_array('stderr'", $contents);
    }

    public function test_rotate_prod_logs_is_copytruncate_without_logrotate(): void
    {
        $script = (string) file_get_contents(dirname(__DIR__, 2).'/bin/rotate-prod-logs');

        $this->assertStringContainsString('cp -p "$file" "${file}.1"', $script);
        $this->assertStringContainsString(': > "$file"', $script);
        $this->assertStringNotContainsString('logrotate', $script);
        $this->assertDoesNotMatchRegularExpression('/mv "\$file" "\$\{file\}\.1"/', $script);
    }

    public function test_tee_service_log_disables_trap_shellcheck(): void
    {
        $script = (string) file_get_contents(dirname(__DIR__, 2).'/bin/tee-service-log.sh');

        $this->assertStringContainsString('shellcheck disable=SC2317,SC2329', $script);
        $this->assertStringContainsString('trap cleanup EXIT', $script);
        $this->assertStringContainsString('> "$fifo" 2>&1', $script);
        $this->assertStringContainsString('stdbuf -oL -eL tee -a', $script);
        $this->assertStringContainsString('umask 002', $script);
        $this->assertStringContainsString('tee-service-log: starting', $script);
    }

    public function test_verify_prod_daily_log_writes_error_marker(): void
    {
        $script = (string) file_get_contents(dirname(__DIR__, 2).'/bin/verify-prod-daily-log');

        $this->assertStringContainsString('Log::error($marker)', $script);
        $this->assertStringContainsString("laravel-'.now()->format('Y-m-d').'.log", $script);
        $this->assertStringContainsString("'0666'", $script);
        $this->assertStringContainsString('bootstrap/app.php', $script);
        $this->assertStringContainsString('Kernel::class)->bootstrap()', $script);
        $this->assertStringNotContainsString('tinker --execute', $script);
        $this->assertStringNotContainsString('PSYSH_CONFIG', $script);
        $this->assertStringNotContainsString('XDG_CONFIG_HOME', $script);
    }

    public function test_deploy_prod_workflow_serializes_without_cancel(): void
    {
        $yml = (string) file_get_contents(dirname(__DIR__, 2).'/.github/workflows/deploy-prod.yml');

        $this->assertStringContainsString('group: deploy-prod', $yml);
        $this->assertStringContainsString('cancel-in-progress: false', $yml);
    }

    public function test_entrypoint_uses_umask_002_not_world_writable_chmod(): void
    {
        $script = (string) file_get_contents(dirname(__DIR__, 2).'/docker/app-entrypoint.sh');
        $fpm = (string) file_get_contents(dirname(__DIR__, 2).'/docker/php/zz-fpm-logging.conf');

        $this->assertStringContainsString('umask 002', $script);
        $this->assertStringContainsString('chmod 0664', $script);
        $this->assertStringContainsString('chown 101:www-data', $script);
        $this->assertStringNotContainsString('chmod 0666', $script);
        $this->assertStringNotContainsString('umask', $fpm); // php-fpm has no umask pool directive; entrypoint umask is inherited
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
        $this->assertSame(str_repeat('a', 200), (string) file_get_contents($root.'/nginx/access.log.1'));
        $this->assertSame('', file_get_contents($root.'/nginx/access.log'));
        $this->assertFileExists($root.'/scheduler/scheduler.log.1');
        $this->assertFileDoesNotExist($root.'/queue/queue.log.1');
        $this->assertFileDoesNotExist($root.'/queue/laravel-2026-10-22.log.1');
        $this->assertSame(200, strlen((string) file_get_contents($root.'/queue/laravel-2026-10-22.log')));

        $this->removeTree($root);
    }

    public function test_logs_host_is_storage_plus_logs(): void
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
        $this->assertSame('./storage/logs', $stdout);

        $command = ['env', 'LATERALZR_STORAGE=/mnt/data/lateralzr/storage', $root.'/bin/logs-host'];
        $process = proc_open($command, $spec, $pipes, $root);
        $this->assertIsResource($process);
        $stdout = trim((string) stream_get_contents($pipes[1]));
        fclose($pipes[1]);
        fclose($pipes[2]);
        $code = proc_close($process);

        $this->assertSame(0, $code);
        $this->assertSame('/mnt/data/lateralzr/storage/logs', $stdout);

        $this->removeTree($root);
    }

    public function test_ensure_prod_log_env_rewrites_single_to_daily_stack(): void
    {
        $file = sys_get_temp_dir().'/lateralzr-log-env-'.uniqid('', true);
        file_put_contents($file, "APP_KEY=base64:test\nLOG_CHANNEL=single\nLOG_STACK=single,stderr\n");
        $script = dirname(__DIR__, 2).'/bin/ensure-prod-log-env';

        exec(sprintf('%s %s', escapeshellarg($script), escapeshellarg($file)), $output, $code);
        $this->assertSame(0, $code, implode("\n", $output));
        $this->assertSame('changed', end($output));

        $contents = (string) file_get_contents($file);
        $this->assertStringContainsString("LOG_CHANNEL=stack\n", $contents);
        $this->assertStringContainsString("LOG_STACK=daily,stderr\n", $contents);
        $this->assertStringNotContainsString('LOG_CHANNEL=single', $contents);
        $this->assertStringContainsString('APP_KEY=base64:test', $contents);

        $output = [];
        exec(sprintf('%s %s', escapeshellarg($script), escapeshellarg($file)), $output, $code);
        $this->assertSame(0, $code);
        $this->assertSame('unchanged', end($output));
        unlink($file);
    }

    public function test_tee_service_log_writes_stdout_and_stderr_before_child_exits(): void
    {
        $log = sys_get_temp_dir().'/lateralzr-tee-'.uniqid('', true).'.log';
        $script = dirname(__DIR__, 2).'/bin/tee-service-log.sh';
        $command = sprintf(
            '%s %s sh -c %s',
            escapeshellarg($script),
            escapeshellarg($log),
            escapeshellarg('echo stdout-line; echo stderr-line >&2; sleep 20')
        );

        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        $this->assertIsResource($process);
        $contents = '';
        for ($i = 0; $i < 25; $i++) {
            usleep(100000);
            $contents = is_file($log) ? (string) file_get_contents($log) : '';
            if (str_contains($contents, 'stdout-line') && str_contains($contents, 'stderr-line')) {
                break;
            }
        }
        proc_terminate($process);
        if (is_resource($pipes[1])) {
            fclose($pipes[1]);
        }
        if (is_resource($pipes[2])) {
            fclose($pipes[2]);
        }
        proc_close($process);
        @unlink($log);

        $this->assertStringContainsString('tee-service-log: starting', $contents);
        $this->assertStringContainsString('stdout-line', $contents);
        $this->assertStringContainsString('stderr-line', $contents);
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
