<?php

namespace App\Services\Enrichment;

final class QualifiedMedia
{
    public function __construct(
        public string $url,
        public string $kind,
        public string $license,
        public string $source = 'wikimedia',
    ) {}
}
