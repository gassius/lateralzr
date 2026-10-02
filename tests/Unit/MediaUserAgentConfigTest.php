<?php

namespace Tests\Unit;

use Illuminate\Support\Env;
use Tests\TestCase;

class MediaUserAgentConfigTest extends TestCase
{
    public function test_blank_media_proxy_user_agent_falls_back_to_default(): void
    {
        $previousEnv = $_ENV['MEDIA_PROXY_USER_AGENT'] ?? null;
        $previousServer = $_SERVER['MEDIA_PROXY_USER_AGENT'] ?? null;
        $previousPutenv = getenv('MEDIA_PROXY_USER_AGENT');

        try {
            $_ENV['MEDIA_PROXY_USER_AGENT'] = '';
            $_SERVER['MEDIA_PROXY_USER_AGENT'] = '';
            putenv('MEDIA_PROXY_USER_AGENT=');
            Env::getRepository()->set('MEDIA_PROXY_USER_AGENT', '');

            $config = require config_path('media.php');

            $this->assertSame(
                'Lateralzr-API/1.0 (https://github.com/gassius/lateralzr; educational)',
                $config['user_agent']
            );
        } finally {
            if ($previousEnv === null) {
                unset($_ENV['MEDIA_PROXY_USER_AGENT']);
            } else {
                $_ENV['MEDIA_PROXY_USER_AGENT'] = $previousEnv;
            }

            if ($previousServer === null) {
                unset($_SERVER['MEDIA_PROXY_USER_AGENT']);
            } else {
                $_SERVER['MEDIA_PROXY_USER_AGENT'] = $previousServer;
            }

            if ($previousPutenv === false) {
                putenv('MEDIA_PROXY_USER_AGENT');
            } else {
                putenv('MEDIA_PROXY_USER_AGENT='.$previousPutenv);
            }

            if ($previousEnv === null && $previousPutenv === false) {
                Env::getRepository()->clear('MEDIA_PROXY_USER_AGENT');
            } else {
                Env::getRepository()->set(
                    'MEDIA_PROXY_USER_AGENT',
                    $previousEnv ?? ($previousPutenv === false ? '' : $previousPutenv)
                );
            }
        }
    }
}
