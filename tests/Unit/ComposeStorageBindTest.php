<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ComposeStorageBindTest extends TestCase
{
    private string $fixtureRoot;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fixtureRoot = sys_get_temp_dir().'/lateralzr-compose-bind-'.uniqid('', true);
        mkdir($this->fixtureRoot.'/bin', 0777, true);
        $helper = dirname(__DIR__, 2).'/bin/compose-storage-bind';
        $this->assertFileIsReadable($helper);
        $this->assertTrue(copy($helper, $this->fixtureRoot.'/bin/compose-storage-bind'));
        chmod($this->fixtureRoot.'/bin/compose-storage-bind', 0755);
    }

    protected function tearDown(): void
    {
        $this->removeTree($this->fixtureRoot);
        parent::tearDown();
    }

    public function test_missing_docker_is_fail_soft_and_writes_stderr(): void
    {
        [$code, $stdout, $stderr] = $this->runHelper(withDocker: false, withPython: true);
        $this->assertSame(0, $code);
        $this->assertSame('', $stdout);
        $this->assertStringContainsString('docker not found', $stderr);
    }

    public function test_missing_python_is_fail_soft_and_writes_stderr(): void
    {
        [$code, $stdout, $stderr] = $this->runHelper(withDocker: true, withPython: false);
        $this->assertSame(0, $code);
        $this->assertSame('', $stdout);
        $this->assertStringContainsString('python3 not found', $stderr);
    }

    public function test_does_not_redirect_compose_stderr_to_dev_null(): void
    {
        $source = file_get_contents(dirname(__DIR__, 2).'/bin/compose-storage-bind');
        $this->assertNotFalse($source);
        $this->assertStringNotContainsString('2>/dev/null', $source);
    }

    /**
     * @return array{0: int, 1: string, 2: string}
     */
    private function runHelper(bool $withDocker, bool $withPython): array
    {
        $pathDir = $this->fixtureRoot.'/path';
        mkdir($pathDir, 0777, true);
        $bash = trim((string) shell_exec('command -v bash'));
        $this->assertNotSame('', $bash);
        $this->assertTrue(symlink($bash, $pathDir.'/bash'));
        if ($withDocker) {
            file_put_contents($pathDir.'/docker', "#!/bin/sh\nexit 1\n");
            chmod($pathDir.'/docker', 0755);
        }
        if ($withPython) {
            $python = trim((string) shell_exec('command -v python3'));
            $this->assertNotSame('', $python);
            $this->assertTrue(symlink($python, $pathDir.'/python3'));
        }

        $command = ['env', 'PATH='.$pathDir, $this->fixtureRoot.'/bin/compose-storage-bind'];
        $spec = [
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $process = proc_open($command, $spec, $pipes, $this->fixtureRoot);
        $this->assertIsResource($process);

        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $code = proc_close($process);

        return [$code, trim((string) $stdout), (string) $stderr];
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
