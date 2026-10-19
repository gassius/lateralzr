<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use InvalidArgumentException;

class ConceptPipelineNode extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_SUCCEEDED = 'succeeded';

    public const STATUS_FAILED = 'failed';

    public const STATUS_SKIPPED = 'skipped';

    public const STAGE_GENERATE = 'generate';

    public const STAGE_LOCALIZE = 'localize';

    public const STAGE_COMPLETE_INFO = 'complete_info';

    public const STAGES = [
        self::STAGE_GENERATE,
        self::STAGE_LOCALIZE,
        self::STAGE_COMPLETE_INFO,
    ];

    protected $table = 'concept_pipeline_nodes';

    protected $fillable = [
        'run_uuid',
        'parent_node_id',
        'concept_id',
        'canonical_key',
        'seed_term',
        'depth',
        'generate_status',
        'generate_started_at',
        'generate_finished_at',
        'generate_error',
        'localize_status',
        'localize_started_at',
        'localize_finished_at',
        'localize_error',
        'complete_info_status',
        'complete_info_started_at',
        'complete_info_finished_at',
        'complete_info_error',
        'created_concept_ids',
    ];

    protected $casts = [
        'concept_id' => 'integer',
        'parent_node_id' => 'integer',
        'depth' => 'integer',
        'generate_started_at' => 'datetime',
        'generate_finished_at' => 'datetime',
        'localize_started_at' => 'datetime',
        'localize_finished_at' => 'datetime',
        'complete_info_started_at' => 'datetime',
        'complete_info_finished_at' => 'datetime',
        'created_concept_ids' => 'array',
    ];

    public function run(): BelongsTo
    {
        return $this->belongsTo(ConceptGraphRun::class, 'run_uuid', 'run_uuid');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_node_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_node_id');
    }

    public function concept(): BelongsTo
    {
        return $this->belongsTo(Concept::class);
    }

    /**
     * @param  self::STAGE_*  $stage
     * @param  self::STATUS_*  $status
     */
    public function markStage(string $stage, string $status, ?string $error = null): void
    {
        $prefix = $this->stagePrefix($stage);

        $values = [
            "{$prefix}_status" => $status,
        ];

        if ($status === self::STATUS_PROCESSING) {
            $values["{$prefix}_started_at"] = now();
            $values["{$prefix}_error"] = null;
        }

        if (in_array($status, [self::STATUS_SUCCEEDED, self::STATUS_FAILED, self::STATUS_SKIPPED], true)) {
            $values["{$prefix}_finished_at"] = now();
            $values["{$prefix}_error"] = $error;
        }

        $this->forceFill($values)->save();
    }

    public function statusFor(string $stage): string
    {
        $prefix = $this->stagePrefix($stage);

        return (string) $this->{"{$prefix}_status"};
    }

    public function errorFor(string $stage): ?string
    {
        $prefix = $this->stagePrefix($stage);
        $error = $this->{"{$prefix}_error"};

        return is_string($error) && $error !== '' ? $error : null;
    }

    public function resetStage(string $stage): void
    {
        $prefix = $this->stagePrefix($stage);

        $this->forceFill([
            "{$prefix}_status" => self::STATUS_PENDING,
            "{$prefix}_started_at" => null,
            "{$prefix}_finished_at" => null,
            "{$prefix}_error" => null,
        ])->save();
    }

    public static function isTerminalStatus(string $status): bool
    {
        return in_array($status, [self::STATUS_SUCCEEDED, self::STATUS_FAILED, self::STATUS_SKIPPED], true);
    }

    public function isFinished(): bool
    {
        foreach (self::STAGES as $stage) {
            if (! self::isTerminalStatus($this->statusFor($stage))) {
                return false;
            }
        }

        return true;
    }

    public function hasActiveStage(): bool
    {
        foreach (self::STAGES as $stage) {
            if (in_array($this->statusFor($stage), [self::STATUS_PENDING, self::STATUS_PROCESSING], true)) {
                return true;
            }
        }

        return false;
    }

    public function finishedDurationSeconds(): ?int
    {
        if (! $this->isFinished()) {
            return null;
        }

        $starts = [];
        $ends = [];

        foreach (self::STAGES as $stage) {
            $prefix = $this->stagePrefix($stage);
            $start = $this->{"{$prefix}_started_at"};
            $end = $this->{"{$prefix}_finished_at"};

            if ($start !== null) {
                $starts[] = $start->getTimestamp();
            }

            if ($end !== null) {
                $ends[] = $end->getTimestamp();
            }
        }

        if ($starts === [] || $ends === []) {
            return null;
        }

        return max(0, max($ends) - min($starts));
    }

    /**
     * Leave later chain stages skipped when an earlier stage failed permanently.
     */
    public function skipPendingStages(): void
    {
        foreach (self::STAGES as $stage) {
            if ($this->statusFor($stage) === self::STATUS_PENDING) {
                $this->markStage($stage, self::STATUS_SKIPPED, 'Skipped because an earlier pipeline stage failed.');
            }
        }
    }

    protected function stagePrefix(string $stage): string
    {
        return match ($stage) {
            self::STAGE_GENERATE => 'generate',
            self::STAGE_LOCALIZE => 'localize',
            self::STAGE_COMPLETE_INFO => 'complete_info',
            default => throw new InvalidArgumentException("Unknown pipeline stage [{$stage}]."),
        };
    }
}
