<?php

namespace App\Ai\Tools;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

final class WikiHttp
{
    public static function client(int $timeoutSeconds = 10): PendingRequest
    {
        return Http::timeout($timeoutSeconds)
            ->withoutVerifying()
            ->withHeaders([
                'User-Agent' => (string) config('media.user_agent'),
            ]);
    }
}
