<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class LintChangedYamlTest extends TestCase
{
    public function test_does_not_shallow_fetch_the_base_ref(): void
    {
        $source = file_get_contents(dirname(__DIR__, 2).'/bin/lint-changed-yaml');
        $this->assertNotFalse($source);
        $this->assertStringNotContainsString('fetch", "--depth"', $source);
        $this->assertStringContainsString('git", "fetch", "origin", base', $source);
    }
}
