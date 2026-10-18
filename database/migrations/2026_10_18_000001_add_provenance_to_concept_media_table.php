<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('concept_media', function (Blueprint $table) {
            $table->string('purpose', 32)->nullable();
            $table->text('alt')->nullable();
            $table->string('creator', 255)->nullable();
            $table->text('source_page_url')->nullable();
            $table->string('licence_name', 128)->nullable();
            $table->text('licence_url')->nullable();
            $table->string('change_notice', 32)->nullable();
            $table->decimal('focal_x', 5, 4)->nullable();
            $table->decimal('focal_y', 5, 4)->nullable();
            $table->string('tone', 16)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('concept_media', function (Blueprint $table) {
            $table->dropColumn([
                'purpose',
                'alt',
                'creator',
                'source_page_url',
                'licence_name',
                'licence_url',
                'change_notice',
                'focal_x',
                'focal_y',
                'tone',
            ]);
        });
    }
};
