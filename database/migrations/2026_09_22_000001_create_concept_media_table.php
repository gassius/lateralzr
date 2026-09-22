<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concept_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('concept_id')->constrained('concepts')->cascadeOnDelete();
            $table->text('url');
            // SHA-256 of the URL. A unique index on the text URL itself exceeds MySQL's key length.
            $table->char('url_sha256', 64);
            $table->string('kind', 16)->default('image');
            $table->string('license', 64);
            $table->string('source', 32)->default('wikimedia');
            $table->unsignedTinyInteger('position')->default(0);
            $table->timestamps();

            $table->unique(['concept_id', 'url_sha256'], 'concept_media_url_unique');
            $table->index(['concept_id', 'position'], 'concept_media_position');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concept_media');
    }
};
