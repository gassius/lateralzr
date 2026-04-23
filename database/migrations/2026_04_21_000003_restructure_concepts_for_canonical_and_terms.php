<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('concepts', function (Blueprint $table) {
            // Canonical concept identity key (deterministic “best-effort” key).
            $table->string('canonical_key')->nullable()->after('id');

            // Optional merge pointer (lets us collapse duplicate canonicals later).
            $table->foreignId('merged_into_concept_id')
                ->nullable()
                ->constrained('concepts')
                ->nullOnDelete()
                ->after('canonical_key');
        });

        // Remove the previous “URL cache” / label fields from concepts (moved to concept_terms).
        Schema::table('concepts', function (Blueprint $table) {
            if (Schema::hasColumn('concepts', 'concept')) {
                // Table was originally `concept_urls`, then renamed. Some databases keep the old index name.
                // Drop both the expected and legacy names, best-effort.
                $driver = DB::getDriverName();
                foreach (['concepts_concept_unique', 'concept_urls_concept_unique'] as $indexName) {
                    try {
                        if ($driver === 'sqlite') {
                            DB::statement("DROP INDEX IF EXISTS \"{$indexName}\"");
                        } else {
                            DB::statement("ALTER TABLE `concepts` DROP INDEX `{$indexName}`");
                        }
                    } catch (\Throwable $e) {
                        // ignore if missing / unsupported
                    }
                }
                $table->dropColumn('concept');
            }
            foreach (['complexity', 'short_description', 'wiki_url', 'media_url'] as $col) {
                if (Schema::hasColumn('concepts', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('concepts', function (Blueprint $table) {
            $table->unique('canonical_key');
        });
    }

    public function down(): void
    {
        Schema::table('concepts', function (Blueprint $table) {
            $table->dropUnique(['canonical_key']);
        });

        Schema::table('concepts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('merged_into_concept_id');
            $table->dropColumn('canonical_key');

            // Best-effort rollback: restore old columns (without data).
            $table->string('concept')->unique()->nullable();
            $table->unsignedTinyInteger('complexity')->default(2);
            $table->text('short_description')->nullable();
            $table->text('wiki_url')->nullable();
            $table->text('media_url')->nullable();
        });
    }
};

