<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concept_relationships', function (Blueprint $table) {
            $table->id();

            $table->foreignId('from_concept_id')->constrained('concepts')->cascadeOnDelete();
            $table->foreignId('to_concept_id')->constrained('concepts')->cascadeOnDelete();

            // Generation-time settings (lets you store multiple "views" of the graph).
            $table->unsignedTinyInteger('complexity')->default(2);
            $table->unsignedTinyInteger('larelality')->nullable(); // 1–5 per agent output

            // Confidence/weight of this edge. LLM runs increase it; future user interactions can modify it.
            $table->unsignedInteger('llm_occurrences')->default(0);
            $table->integer('user_weight')->default(0);
            $table->decimal('strength', 6, 5)->default(0); // 0..1

            $table->string('provider')->nullable();
            $table->string('model')->nullable();
            $table->uuid('last_run_uuid')->nullable();
            $table->timestamp('last_generated_at')->nullable();

            $table->timestamps();

            $table->unique(['from_concept_id', 'to_concept_id', 'complexity'], 'concept_rel_unique_edge');
            $table->index(['from_concept_id', 'complexity', 'strength'], 'concept_rel_from_complexity_strength');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concept_relationships');
    }
};

