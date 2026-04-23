<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concept_terms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('concept_id')->constrained('concepts')->cascadeOnDelete();
            $table->string('locale', 16)->default('en');

            $table->string('term', 255);
            $table->string('normalized_term', 255);

            $table->text('short_description')->nullable();
            $table->text('wiki_url')->nullable();
            $table->text('media_url')->nullable();

            $table->boolean('is_preferred')->default(true);

            $table->timestamps();

            // For the POC, keep lookup deterministic and unambiguous.
            $table->unique(['locale', 'normalized_term'], 'concept_terms_locale_norm_unique');
            $table->index(['concept_id', 'locale', 'is_preferred'], 'concept_terms_concept_locale_preferred');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concept_terms');
    }
};

