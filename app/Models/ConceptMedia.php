<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConceptMedia extends Model
{
    protected $table = 'concept_media';

    protected $fillable = [
        'concept_id',
        'url',
        'url_sha256',
        'kind',
        'license',
        'source',
        'position',
        'purpose',
        'alt',
        'creator',
        'source_page_url',
        'licence_name',
        'licence_url',
        'change_notice',
        'focal_x',
        'focal_y',
        'tone',
    ];

    protected $casts = [
        'position' => 'integer',
        'focal_x' => 'float',
        'focal_y' => 'float',
    ];

    protected static function booted(): void
    {
        static::saving(function (ConceptMedia $media): void {
            if (is_string($media->url) && $media->url !== '') {
                $media->url_sha256 = hash('sha256', $media->url);
            }
        });
    }

    public function concept(): BelongsTo
    {
        return $this->belongsTo(Concept::class);
    }
}
