<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('concept_graph_runs', function (Blueprint $table) {
            $table->string('type', 32)->default('graph')->after('run_uuid');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::table('concept_graph_runs', function (Blueprint $table) {
            $table->dropIndex(['type']);
            $table->dropColumn('type');
        });
    }
};
