<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scheduled_tasks', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->boolean('enabled')->default(false);
            $table->string('cadence')->default('daily');
            $table->unsignedInteger('per_run_cap')->default(10);
            $table->json('options')->nullable();
            $table->timestamp('last_run_at')->nullable();
            $table->timestamp('next_run_at')->nullable();
            $table->timestamps();
        });

        Schema::create('scheduled_task_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('scheduled_task_id')->constrained('scheduled_tasks')->cascadeOnDelete();
            $table->string('task_key');
            $table->string('trigger', 16)->default('scheduled');
            $table->string('status', 24)->default('running');
            $table->unsignedInteger('items_processed')->default(0);
            $table->uuid('pipeline_run_uuid')->nullable()->index();
            $table->json('details')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->index(['scheduled_task_id', 'started_at'], 'scheduled_task_runs_task_started');
        });

        $now = now();

        DB::table('scheduled_tasks')->insert([
            [
                'key' => 'grow-sparse',
                'enabled' => false,
                'cadence' => 'daily',
                'per_run_cap' => 10,
                'options' => json_encode([
                    'threshold' => 2,
                    'count' => 10,
                    'complexity' => 3,
                    'depth' => 1,
                ]),
                'last_run_at' => null,
                'next_run_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'fill-missing',
                'enabled' => false,
                'cadence' => 'daily',
                'per_run_cap' => 20,
                'options' => json_encode([
                    'locale' => 'es',
                    'from' => 'en',
                    'fill_locale' => true,
                    'fill_images' => true,
                ]),
                'last_run_at' => null,
                'next_run_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('scheduled_task_runs');
        Schema::dropIfExists('scheduled_tasks');
    }
};
