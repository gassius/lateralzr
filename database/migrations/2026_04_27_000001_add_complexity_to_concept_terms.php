<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('concept_terms', function (Blueprint $table) {
            $table->unsignedTinyInteger('complexity')
                ->default((int) config('concepts.default_complexity', 2))
                ->after('media_url');

            $table->index(['locale', 'complexity'], 'concept_terms_locale_complexity');
        });
    }

    public function down(): void
    {
        Schema::table('concept_terms', function (Blueprint $table) {
            $table->dropIndex('concept_terms_locale_complexity');
            $table->dropColumn('complexity');
        });
    }
};
