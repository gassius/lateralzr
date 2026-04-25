<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concept_graph_runs', function (Blueprint $table) {
            $table->id();
            $table->uuid('run_uuid')->unique();

            $table->string('provider')->nullable();
            $table->string('model')->nullable();
            $table->unsignedTinyInteger('complexity')->default(2);
            $table->string('queue')->default('default');
            $table->unsignedInteger('seed_count')->default(0);

            // For traceability / UI display.
            $table->json('seeds')->nullable();
            $table->unsignedTinyInteger('related_count')->nullable(); // per-seed (1..10)

            $table->timestamp('dispatched_at')->nullable();

            $table->timestamps();
        });

        Schema::create('concept_graph_run_jobs', function (Blueprint $table) {
            $table->id();
            $table->uuid('run_uuid')->index();
            $table->string('seed', 255);

            $table->string('status', 24)->default('pending'); // pending|processing|succeeded|failed
            $table->unsignedTinyInteger('attempts')->default(0);

            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->text('error_message')->nullable();

            $table->timestamps();

            $table->unique(['run_uuid', 'seed'], 'concept_graph_run_jobs_unique');
            $table->index(['run_uuid', 'status'], 'concept_graph_run_jobs_run_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concept_graph_run_jobs');
        Schema::dropIfExists('concept_graph_runs');
    }
};

