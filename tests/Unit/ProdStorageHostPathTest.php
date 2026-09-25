<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ProdStorageHostPathTest extends TestCase
{
    private string $fixtureRoot;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fixtureRoot = sys_get_temp_dir().'/lateralzr-storage-host-'.uniqid('', true);
        mkdir($this->fixtureRoot.'/bin', 0777, true);
        $helper = dirname(__DIR__, 2).'/bin/storage-host';
        $this->assertFileIsReadable($helper);
        $this->assertTrue(copy($helper, $this->fixtureRoot.'/bin/storage-host'));
        chmod($this->fixtureRoot.'/bin/storage-host', 0755);
    }

    protected function tearDown(): void
    {
        $this->removeTree($this->fixtureRoot);
        parent::tearDown();
    }

    public function test_unset_and_empty_resolve_to_default(): void
    {
        [$code, $stdout] = $this->runHelper(['LATERALZR_STORAGE' => null]);
        $this->assertSame(0, $code);
        $this->assertSame('./storage', $stdout);

        [$code, $stdout] = $this->runHelper(['LATERALZR_STORAGE' => '']);
        $this->assertSame(0, $code);
        $this->assertSame('./storage', $stdout);
    }

    public function test_shell_env_wins_over_dotenv(): void
    {
        file_put_contents($this->fixtureRoot.'/.env', "LATERALZR_STORAGE=/mnt/from-env\n");

        [$code, $stdout] = $this->runHelper(['LATERALZR_STORAGE' => '/mnt/from-shell']);
        $this->assertSame(0, $code);
        $this->assertSame('/mnt/from-shell', $stdout);
    }

    public function test_dotenv_is_used_when_shell_var_is_unset(): void
    {
        file_put_contents($this->fixtureRoot.'/.env', "LATERALZR_STORAGE=/mnt/from-env\n");

        [$code, $stdout] = $this->runHelper(['LATERALZR_STORAGE' => null]);
        $this->assertSame(0, $code);
        $this->assertSame('/mnt/from-env', $stdout);
    }

    public function test_empty_shell_var_does_not_read_dotenv(): void
    {
        file_put_contents($this->fixtureRoot.'/.env', "LATERALZR_STORAGE=/mnt/from-env\n");

        [$code, $stdout] = $this->runHelper(['LATERALZR_STORAGE' => '']);
        $this->assertSame(0, $code);
        $this->assertSame('./storage', $stdout);
    }

    public function test_rejects_colon_and_whitespace(): void
    {
        [$code, $stdout, $stderr] = $this->runHelper(['LATERALZR_STORAGE' => '/mnt/data:oops']);
        $this->assertSame(1, $code);
        $this->assertSame('', $stdout);
        $this->assertStringContainsString('must not contain', $stderr);

        [$code] = $this->runHelper(['LATERALZR_STORAGE' => '/mnt/data /oops']);
        $this->assertSame(1, $code);
    }

    public function test_dotenv_quoted_and_padded_simple_values_match_previous_helper(): void
    {
        file_put_contents($this->fixtureRoot.'/.env', "LATERALZR_STORAGE=\"/mnt/from-env\"\n");
        [$code, $stdout] = $this->runHelper(['LATERALZR_STORAGE' => null]);
        $this->assertSame(0, $code);
        $this->assertSame('/mnt/from-env', $stdout);

        file_put_contents($this->fixtureRoot.'/.env', "LATERALZR_STORAGE='/mnt/from-env'\n");
        [$code, $stdout] = $this->runHelper(['LATERALZR_STORAGE' => null]);
        $this->assertSame(0, $code);
        $this->assertSame('/mnt/from-env', $stdout);

        file_put_contents($this->fixtureRoot.'/.env', "LATERALZR_STORAGE=/mnt/from-env  \n");
        [$code, $stdout] = $this->runHelper(['LATERALZR_STORAGE' => null]);
        $this->assertSame(0, $code);
        $this->assertSame('/mnt/from-env', $stdout);
    }

    public function test_dotenv_interior_whitespace_is_rejected_not_collapsed(): void
    {
        file_put_contents($this->fixtureRoot.'/.env', "LATERALZR_STORAGE=\"/mnt/env storage\"\n");

        [$code, $stdout, $stderr] = $this->runHelper(['LATERALZR_STORAGE' => null]);
        $this->assertSame(1, $code);
        $this->assertSame('', $stdout);
        $this->assertStringContainsString('must not contain', $stderr);
        $this->assertStringContainsString('/mnt/env storage', $stderr);
        $this->assertStringNotContainsString('/mnt/envstorage', $stderr);
    }

    public function test_require_ready_allows_missing_default_path(): void
    {
        [$code, $stdout] = $this->runHelper(['LATERALZR_STORAGE' => null], ['--require-ready']);
        $this->assertSame(0, $code);
        $this->assertSame('./storage', $stdout);
    }

    public function test_require_ready_rejects_missing_non_default_path(): void
    {
        [$code, $stdout, $stderr] = $this->runHelper(
            ['LATERALZR_STORAGE' => $this->fixtureRoot.'/missing-volume'],
            ['--require-ready']
        );
        $this->assertSame(1, $code);
        $this->assertSame('', $stdout);
        $this->assertStringContainsString('not an existing directory', $stderr);
    }

    public function test_require_ready_rejects_unmounted_path_without_marker(): void
    {
        $path = $this->fixtureRoot.'/unmounted';
        mkdir($path, 0777, true);

        [$code, $stdout, $stderr] = $this->runHelper(
            ['LATERALZR_STORAGE' => $path],
            ['--require-ready']
        );

        if ($this->pathIsOnNonRootMount($path)) {
            $this->assertSame(0, $code, 'path is already on a non-root mount, so deploy would accept it');
            $this->assertSame($path, $stdout);

            return;
        }

        $this->assertSame(1, $code);
        $this->assertSame('', $stdout);
        $this->assertStringContainsString('not a mounted volume', $stderr);
    }

    public function test_require_ready_accepts_marker_file(): void
    {
        $path = $this->fixtureRoot.'/marked';
        mkdir($path, 0777, true);
        file_put_contents($path.'/.lateralzr-storage', '');

        [$code, $stdout] = $this->runHelper(
            ['LATERALZR_STORAGE' => $path],
            ['--require-ready']
        );
        $this->assertSame(0, $code);
        $this->assertSame($path, $stdout);
    }

    /**
     * @param  array<string, string|null>  $env
     * @param  list<string>  $args
     * @return array{0: int, 1: string, 2: string}
     */
    private function runHelper(array $env, array $args = []): array
    {
        $processEnv = getenv();
        if ($processEnv === false) {
            $processEnv = [];
        }

        $command = ['env'];
        foreach ($env as $key => $value) {
            if ($value === null) {
                $command[] = '-u';
                $command[] = $key;
                unset($processEnv[$key]);
            } else {
                $command[] = $key.'='.$value;
            }
        }
        $command[] = $this->fixtureRoot.'/bin/storage-host';
        $command = array_merge($command, $args);

        $spec = [
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $process = proc_open($command, $spec, $pipes, $this->fixtureRoot, $processEnv);
        $this->assertIsResource($process);

        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $code = proc_close($process);

        return [$code, trim((string) $stdout), (string) $stderr];
    }

    private function pathIsOnNonRootMount(string $path): bool
    {
        $target = trim((string) shell_exec('findmnt -T '.escapeshellarg($path).' -no TARGET 2>/dev/null'));

        return $target !== '' && $target !== '/';
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
