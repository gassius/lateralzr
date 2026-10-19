<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concept_pipeline_nodes', function (Blueprint $table) {
            $table->id();
            $table->uuid('run_uuid')->index();
            $table->foreignId('parent_node_id')->nullable()->constrained('concept_pipeline_nodes')->nullOnDelete();
            $table->unsignedBigInteger('concept_id')->nullable()->index();
            $table->string('canonical_key');
            $table->string('seed_term');
            $table->unsignedTinyInteger('depth')->default(0);

            $table->string('generate_status', 24)->default('pending');
            $table->timestamp('generate_started_at')->nullable();
            $table->timestamp('generate_finished_at')->nullable();
            $table->text('generate_error')->nullable();

            $table->string('localize_status', 24)->default('pending');
            $table->timestamp('localize_started_at')->nullable();
            $table->timestamp('localize_finished_at')->nullable();
            $table->text('localize_error')->nullable();

            $table->string('complete_info_status', 24)->default('pending');
            $table->timestamp('complete_info_started_at')->nullable();
            $table->timestamp('complete_info_finished_at')->nullable();
            $table->text('complete_info_error')->nullable();

            $table->json('created_concept_ids')->nullable();

            $table->timestamps();

            $table->unique(['run_uuid', 'canonical_key'], 'concept_pipeline_nodes_run_key_unique');
            $table->index(['run_uuid', 'depth'], 'concept_pipeline_nodes_run_depth');
            $table->index(['run_uuid', 'generate_status'], 'concept_pipeline_nodes_run_generate');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concept_pipeline_nodes');
    }
};
