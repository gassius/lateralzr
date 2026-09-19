<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Strip legacy locale prefixes from canonical_key (e.g. en:creativity → creativity)
     * so one concept can hold multiple locale terms.
     */
    public function up(): void
    {
        $supported = array_values(array_filter(array_map(
            static fn (string $locale) => strtolower(trim($locale)),
            explode(',', (string) env('CONCEPTS_SUPPORTED_LOCALES', 'en,es'))
        )));

        if ($supported === []) {
            $supported = ['en', 'es'];
        }

        $rows = DB::table('concepts')->select('id', 'canonical_key')->orderBy('id')->get();
        $used = [];

        foreach ($rows as $row) {
            $key = (string) $row->canonical_key;
            $stripped = $key;

            foreach ($supported as $locale) {
                $prefix = $locale.':';
                if (str_starts_with($stripped, $prefix)) {
                    $stripped = substr($stripped, strlen($prefix));
                    break;
                }
            }

            if ($stripped === '' || $stripped === $key) {
                $used[$key] = true;

                continue;
            }

            $candidate = $stripped;
            $suffix = 2;
            while (isset($used[$candidate]) || DB::table('concepts')
                ->where('canonical_key', $candidate)
                ->where('id', '!=', $row->id)
                ->exists()) {
                $candidate = $stripped.'-'.$suffix;
                $suffix++;
            }

            DB::table('concepts')->where('id', $row->id)->update([
                'canonical_key' => $candidate,
            ]);
            $used[$candidate] = true;
        }
    }

    public function down(): void
    {
        // Irreversible data migration — locale prefixes are not restored.
    }
};
