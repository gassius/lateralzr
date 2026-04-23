<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop previous edge table (older implementation mixed provenance + edge).
        Schema::dropIfExists('concept_relationships');

        Schema::create('concept_relationships', function (Blueprint $table) {
            $table->id();

            $table->foreignId('from_concept_id')->constrained('concepts')->cascadeOnDelete();
            $table->foreignId('to_concept_id')->constrained('concepts')->cascadeOnDelete();

            $table->string('relationship_type', 32)->default('lateral');
            $table->unsignedTinyInteger('complexity')->default(2);

            // Cached/materialized score for fast reads.
            $table->decimal('strength', 6, 5)->default(0);

            // Cached aggregates (derived from evidence + feedback).
            $table->unsignedInteger('llm_occurrences')->default(0);
            $table->integer('user_weight')->default(0);

            $table->unsignedTinyInteger('last_larelality')->nullable();
            $table->timestamp('last_generated_at')->nullable();

            $table->timestamps();

            $table->unique(['from_concept_id', 'to_concept_id', 'relationship_type', 'complexity'], 'concept_rel_unique');
            $table->index(['from_concept_id', 'complexity', 'strength'], 'concept_rel_from_complexity_strength');
        });

        Schema::create('relationship_evidences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('concept_relationship_id')->constrained('concept_relationships')->cascadeOnDelete();

            $table->string('provider')->nullable();
            $table->string('model')->nullable();
            $table->uuid('run_uuid')->nullable();

            $table->unsignedTinyInteger('larelality')->nullable();
            $table->string('seed_term', 255)->nullable();
            $table->string('related_term', 255)->nullable();

            $table->json('raw_json')->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index(['concept_relationship_id', 'created_at'], 'rel_evidence_rel_created');
        });

        Schema::create('relationship_feedback', function (Blueprint $table) {
            $table->id();
            $table->foreignId('concept_relationship_id')->constrained('concept_relationships')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            // Signed user weight adjustment. Positive strengthens, negative weakens.
            $table->integer('weight')->default(0);
            $table->json('meta')->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index(['concept_relationship_id', 'created_at'], 'rel_feedback_rel_created');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('relationship_feedback');
        Schema::dropIfExists('relationship_evidences');
        Schema::dropIfExists('concept_relationships');
    }
};

