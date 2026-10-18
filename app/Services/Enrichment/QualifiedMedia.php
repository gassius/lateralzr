<?php

namespace App\Services\Enrichment;

final class QualifiedMedia
{
    public function __construct(
        public string $url,
        public string $kind,
        public string $license,
        public string $source = 'wikimedia',
        public ?string $purpose = null,
        public ?string $alt = null,
        public ?string $creator = null,
        public ?string $sourcePageUrl = null,
        public ?string $licenceName = null,
        public ?string $licenceUrl = null,
        public ?string $changeNotice = null,
        public ?float $focalX = null,
        public ?float $focalY = null,
        public ?string $tone = null,
    ) {}
}
