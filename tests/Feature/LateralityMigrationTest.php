<?php

namespace Tests\Feature;

use App\Models\Concept;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LateralityMigrationTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        $this->restoreFloatLateralityColumns();
        parent::tearDown();
    }

    public function test_laterality_migration_round_trips_ints_and_maps_045_to_grade_three(): void
    {
        $ids = $this->seedIntegerLateralityRows();

        $migration = $this->lateralityMigration();
        $migration->up();

        $this->assertSame(
            [0.0, 0.25, 0.5, 0.75, 1.0, null],
            $this->relationshipScores($ids)
        );
        $this->assertSame(
            [0.0, 0.25, 0.5, 0.75, 1.0, null],
            $this->evidenceScores($ids)
        );

        $migration->down();

        $this->assertSame(
            [1, 2, 3, 4, 5, null],
            $this->relationshipGrades($ids)
        );
        $this->assertSame(
            [1, 2, 3, 4, 5, null],
            $this->evidenceGrades($ids)
        );

        $migration->up();

        $this->assertSame(
            [0.0, 0.25, 0.5, 0.75, 1.0, null],
            $this->relationshipScores($ids)
        );

        DB::table('concept_relationships')->where('id', $ids['relationships'][0])->update([
            'last_laterality' => 0.45,
        ]);
        $migration->down();
        $rolled = DB::table('concept_relationships')->where('id', $ids['relationships'][0])->value('last_laterality');
        $this->assertSame(3, (int) $rolled);
    }

    public function test_laterality_migration_resumes_when_tmp_column_already_exists(): void
    {
        $ids = $this->seedIntegerLateralityRows();

        Schema::table('concept_relationships', function (Blueprint $blueprint) {
            $blueprint->decimal('last_laterality_tmp', 3, 2)->nullable();
        });
        Schema::table('relationship_evidences', function (Blueprint $blueprint) {
            $blueprint->decimal('laterality_tmp', 3, 2)->nullable();
        });

        $this->lateralityMigration()->up();

        $this->assertFalse(Schema::hasColumn('concept_relationships', 'last_laterality_tmp'));
        $this->assertFalse(Schema::hasColumn('relationship_evidences', 'laterality_tmp'));
        $this->assertTrue(Schema::hasColumn('concept_relationships', 'last_laterality'));
        $this->assertSame(
            [0.0, 0.25, 0.5, 0.75, 1.0, null],
            $this->relationshipScores($ids)
        );
    }

    public function test_laterality_migration_logs_out_of_range_ints_instead_of_clamping(): void
    {
        $ids = $this->seedIntegerLateralityRows();
        DB::table('concept_relationships')->where('id', $ids['relationships'][0])->update([
            'last_laterality' => 9,
        ]);

        Log::spy();
        $this->lateralityMigration()->up();

        Log::shouldHaveReceived('warning')->withArgs(function (string $message): bool {
            return str_contains($message, 'out-of-range') && str_contains($message, 'concept_relationships.last_laterality');
        })->once();

        $mapped = DB::table('concept_relationships')->where('id', $ids['relationships'][0])->value('last_laterality');
        $this->assertNull($mapped);
    }

    /**
     * @return array{from: int, tos: list<int>, relationships: list<int>, evidences: list<int>}
     */
    private function seedIntegerLateralityRows(): array
    {
        $this->lateralityMigration()->down();

        $from = Concept::query()->create(['canonical_key' => 'laterality-from'])->id;
        $tos = [];
        foreach (range(1, 6) as $i) {
            $tos[] = Concept::query()->create(['canonical_key' => "laterality-to-{$i}"])->id;
        }

        $grades = [1, 2, 3, 4, 5, null];
        $relationshipIds = [];
        $evidenceIds = [];
        foreach ($grades as $index => $grade) {
            $relationshipIds[] = DB::table('concept_relationships')->insertGetId([
                'from_concept_id' => $from,
                'to_concept_id' => $tos[$index],
                'strength' => 0.5,
                'llm_occurrences' => 1,
                'user_weight' => 0,
                'last_laterality' => $grade,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $evidenceIds[] = DB::table('relationship_evidences')->insertGetId([
                'concept_relationship_id' => $relationshipIds[$index],
                'provider' => 'test',
                'model' => 'test',
                'run_uuid' => 'run-laterality-migration',
                'laterality' => $grade,
                'from_term' => 'from',
                'to_term' => 'to-'.$index,
                'created_at' => now(),
            ]);
        }

        return [
            'from' => $from,
            'tos' => $tos,
            'relationships' => $relationshipIds,
            'evidences' => $evidenceIds,
        ];
    }

    /**
     * @param  array{relationships: list<int>, evidences: list<int>}  $ids
     * @return list<float|null>
     */
    private function relationshipScores(array $ids): array
    {
        return collect($ids['relationships'])
            ->map(function (int $id): ?float {
                $value = DB::table('concept_relationships')->where('id', $id)->value('last_laterality');

                return $value === null ? null : round((float) $value, 2);
            })
            ->all();
    }

    /**
     * @param  array{relationships: list<int>, evidences: list<int>}  $ids
     * @return list<int|null>
     */
    private function relationshipGrades(array $ids): array
    {
        return collect($ids['relationships'])
            ->map(function (int $id): ?int {
                $value = DB::table('concept_relationships')->where('id', $id)->value('last_laterality');

                return $value === null ? null : (int) $value;
            })
            ->all();
    }

    /**
     * @param  array{evidences: list<int>}  $ids
     * @return list<float|null>
     */
    private function evidenceScores(array $ids): array
    {
        return collect($ids['evidences'])
            ->map(function (int $id): ?float {
                $value = DB::table('relationship_evidences')->where('id', $id)->value('laterality');

                return $value === null ? null : round((float) $value, 2);
            })
            ->all();
    }

    /**
     * @param  array{evidences: list<int>}  $ids
     * @return list<int|null>
     */
    private function evidenceGrades(array $ids): array
    {
        return collect($ids['evidences'])
            ->map(function (int $id): ?int {
                $value = DB::table('relationship_evidences')->where('id', $id)->value('laterality');

                return $value === null ? null : (int) $value;
            })
            ->all();
    }

    private function lateralityMigration(): Migration
    {
        /** @var Migration $migration */
        $migration = require database_path('migrations/2026_10_19_000001_convert_laterality_to_zero_one_decimal.php');

        return $migration;
    }

    private function restoreFloatLateralityColumns(): void
    {
        if (! Schema::hasTable('concept_relationships')) {
            return;
        }

        $migration = $this->lateralityMigration();
        if (Schema::hasColumn('concept_relationships', 'last_laterality_tmp')
            || Schema::hasColumn('relationship_evidences', 'laterality_tmp')
            || $this->columnLooksInteger('concept_relationships', 'last_laterality')) {
            $migration->up();
        }
    }

    private function columnLooksInteger(string $table, string $column): bool
    {
        if (! Schema::hasColumn($table, $column)) {
            return false;
        }

        $type = strtolower((string) Schema::getColumnType($table, $column));

        return in_array($type, ['integer', 'int', 'tinyinteger', 'tinyint', 'smallint', 'bigint', 'mediumint'], true);
    }
}
