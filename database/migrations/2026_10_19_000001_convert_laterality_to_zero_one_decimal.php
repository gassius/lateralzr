<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->convertColumn('concept_relationships', 'last_laterality', toFloat: true);
        $this->convertColumn('relationship_evidences', 'laterality', toFloat: true);
    }

    public function down(): void
    {
        $this->convertColumn('concept_relationships', 'last_laterality', toFloat: false);
        $this->convertColumn('relationship_evidences', 'laterality', toFloat: false);
    }

    protected function convertColumn(string $table, string $column, bool $toFloat): void
    {
        $temporary = $column.'_tmp';
        $hasColumn = Schema::hasColumn($table, $column);
        $hasTemporary = Schema::hasColumn($table, $temporary);

        if (! $hasColumn && $hasTemporary) {
            Schema::table($table, function (Blueprint $blueprint) use ($temporary, $column) {
                $blueprint->renameColumn($temporary, $column);
            });

            return;
        }

        if (! $hasColumn) {
            return;
        }

        if ($toFloat && $this->isFloatLateralityColumn($table, $column) && ! $hasTemporary) {
            return;
        }

        if (! $toFloat && $this->isIntegerLateralityColumn($table, $column) && ! $hasTemporary) {
            return;
        }

        if ($toFloat && $this->isFloatLateralityColumn($table, $column) && $hasTemporary) {
            Schema::table($table, function (Blueprint $blueprint) use ($temporary) {
                $blueprint->dropColumn($temporary);
            });

            return;
        }

        if (! $hasTemporary) {
            Schema::table($table, function (Blueprint $blueprint) use ($temporary, $toFloat) {
                if ($toFloat) {
                    $blueprint->decimal($temporary, 3, 2)->nullable();
                } else {
                    $blueprint->unsignedTinyInteger($temporary)->nullable();
                }
            });
        }

        if ($toFloat) {
            $this->backfillToFloat($table, $column, $temporary);
        } else {
            $quotedColumn = $this->quoteIdentifier($column);
            DB::table($table)->update([
                $temporary => DB::raw("CASE WHEN {$quotedColumn} IS NULL THEN NULL ELSE ROUND({$quotedColumn} * 4) + 1 END"),
            ]);
        }

        if (Schema::hasColumn($table, $column)) {
            Schema::table($table, function (Blueprint $blueprint) use ($column) {
                $blueprint->dropColumn($column);
            });
        }

        if (Schema::hasColumn($table, $temporary) && ! Schema::hasColumn($table, $column)) {
            Schema::table($table, function (Blueprint $blueprint) use ($temporary, $column) {
                $blueprint->renameColumn($temporary, $column);
            });
        }
    }

    protected function backfillToFloat(string $table, string $column, string $temporary): void
    {
        $outOfRange = (int) DB::table($table)
            ->whereNotNull($column)
            ->whereNotIn($column, [1, 2, 3, 4, 5])
            ->count();

        if ($outOfRange > 0) {
            Log::warning("Laterality migration: {$outOfRange} out-of-range {$table}.{$column} row(s) mapped to NULL instead of clamping.");
        }

        $quotedColumn = $this->quoteIdentifier($column);
        DB::table($table)->update([
            $temporary => DB::raw(
                "CASE {$quotedColumn} "
                .'WHEN 1 THEN 0 '
                .'WHEN 2 THEN 0.25 '
                .'WHEN 3 THEN 0.5 '
                .'WHEN 4 THEN 0.75 '
                .'WHEN 5 THEN 1 '
                .'ELSE NULL END'
            ),
        ]);
    }

    protected function isIntegerLateralityColumn(string $table, string $column): bool
    {
        $type = strtolower((string) Schema::getColumnType($table, $column));

        return in_array($type, ['integer', 'int', 'tinyinteger', 'tinyint', 'smallint', 'bigint', 'mediumint'], true);
    }

    protected function isFloatLateralityColumn(string $table, string $column): bool
    {
        $type = strtolower((string) Schema::getColumnType($table, $column));

        return in_array($type, ['decimal', 'numeric', 'float', 'double', 'real'], true);
    }

    protected function quoteIdentifier(string $name): string
    {
        $grammar = DB::connection()->getQueryGrammar();

        return $grammar->wrap($name);
    }
};
