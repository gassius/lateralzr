<?php

use App\Support\Laterality;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
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

        Schema::table($table, function (Blueprint $blueprint) use ($temporary, $toFloat) {
            if ($toFloat) {
                $blueprint->decimal($temporary, 3, 2)->nullable();
            } else {
                $blueprint->unsignedTinyInteger($temporary)->nullable();
            }
        });

        foreach (DB::table($table)->orderBy('id')->cursor() as $row) {
            $raw = $row->{$column} ?? null;
            $mapped = $toFloat
                ? Laterality::fromLegacyInteger($raw)
                : Laterality::toLegacyInteger($raw === null ? null : (float) $raw);

            DB::table($table)->where('id', $row->id)->update([
                $temporary => $mapped,
            ]);
        }

        Schema::table($table, function (Blueprint $blueprint) use ($column) {
            $blueprint->dropColumn($column);
        });

        Schema::table($table, function (Blueprint $blueprint) use ($temporary, $column) {
            $blueprint->renameColumn($temporary, $column);
        });
    }
};
