<?php

namespace Tests\Feature;

use App\Models\Concept;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Services\ConceptCanonicalizer;
use App\Services\ConceptGraphStore;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use PDO;
use Tests\TestCase;

class ConceptGraphRepeatableReadRaceTest extends TestCase
{
    private ?string $previousDefault = null;

    private ?string $mysqlSkipReason = null;

    protected function setUp(): void
    {
        parent::setUp();

        if (! $this->configureMysqlRaceConnections()) {
            $this->markTestSkipped($this->mysqlSkipReason ?? 'MySQL is required to exercise REPEATABLE READ snapshot races.');
        }
    }

    protected function tearDown(): void
    {
        if ($this->previousDefault !== null) {
            config(['database.default' => $this->previousDefault]);
            DB::setDefaultConnection($this->previousDefault);
        }

        parent::tearDown();
    }

    public function test_upsert_edge_recovers_when_sibling_commits_inside_open_transaction(): void
    {
        $from = Concept::query()->create(['canonical_key' => 'ball-rr']);
        $to = Concept::query()->create(['canonical_key' => 'algorithm-rr']);
        $store = app(ConceptGraphStore::class);

        $edge = DB::connection('mysql_rr')->transaction(function () use ($from, $to, $store) {
            $this->assertNull($this->edgeOnDefault($from->id, $to->id));

            DB::connection('mysql_rr_sibling')->table('concept_relationships')->insert([
                'from_concept_id' => $from->id,
                'to_concept_id' => $to->id,
                'strength' => 0.28000,
                'llm_occurrences' => 1,
                'user_weight' => 0,
                'last_laterality' => 0.5,
                'last_generated_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->assertNull(
                $this->edgeOnDefault($from->id, $to->id),
                'Plain SELECT must still see the REPEATABLE READ snapshot after the sibling commit.'
            );

            return $store->upsertEdge($from, $to, 0.75);
        });

        $this->assertSame(2, (int) $edge->llm_occurrences);
        $this->assertEqualsWithDelta(0.75, (float) $edge->last_laterality, 0.001);
        $this->assertSame(1, ConceptRelationship::query()
            ->where('from_concept_id', $from->id)
            ->where('to_concept_id', $to->id)
            ->count());
    }

    public function test_canonical_recovery_sees_sibling_commit_inside_open_transaction(): void
    {
        $resolved = DB::connection('mysql_rr')->transaction(function () {
            $this->assertNull(Concept::query()->where('canonical_key', 'origami-rr')->first());

            $conceptId = (int) DB::connection('mysql_rr_sibling')->table('concepts')->insertGetId([
                'canonical_key' => 'origami-rr',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::connection('mysql_rr_sibling')->table('concept_terms')->insert([
                'concept_id' => $conceptId,
                'locale' => 'en',
                'term' => 'origami-rr',
                'normalized_term' => 'origami-rr',
                'short_description' => null,
                'is_preferred' => true,
                'complexity' => 2,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->assertNull(
                Concept::query()->where('canonical_key', 'origami-rr')->first(),
                'Plain SELECT must still see the REPEATABLE READ snapshot after the sibling commit.'
            );

            $concept = app(ConceptCanonicalizer::class)->resolveOrCreate(
                term: 'origami-rr',
                locale: 'en',
                shortDescription: 'Folded paper.',
                complexity: 3
            );

            $this->assertSame($conceptId, $concept->id);

            return $concept;
        });

        $this->assertSame(1, ConceptTerm::query()->where('locale', 'en')->where('normalized_term', 'origami-rr')->count());
        $this->assertSame('Folded paper.', $resolved->fresh()->termForLocale('en', fallback: false)?->short_description);
    }

    private function edgeOnDefault(int $fromId, int $toId): ?ConceptRelationship
    {
        return ConceptRelationship::query()
            ->where('from_concept_id', $fromId)
            ->where('to_concept_id', $toId)
            ->first();
    }

    private function configureMysqlRaceConnections(): bool
    {
        if (! extension_loaded('pdo_mysql')) {
            $this->mysqlSkipReason = 'pdo_mysql extension is not loaded.';

            return false;
        }

        $mysql = config('database.connections.mysql', []);
        $host = $this->mysqlRaceValue('MYSQL_RACE_HOST', $mysql['host'] ?? '');
        $port = (int) $this->mysqlRaceValue('MYSQL_RACE_PORT', $mysql['port'] ?? 3306);
        $username = $this->mysqlRaceValue('MYSQL_RACE_USERNAME', $mysql['username'] ?? 'root');
        $password = $this->mysqlRaceValue('MYSQL_RACE_PASSWORD', $mysql['password'] ?? '');
        $database = $this->mysqlRaceValue('MYSQL_RACE_DATABASE', 'testing');

        if ($host === '' || $host === 'sqlite' || str_contains($database, '.sqlite')) {
            $this->mysqlSkipReason = "Invalid MySQL race host [{$host}] or database [{$database}].";

            return false;
        }

        try {
            $this->ensureMysqlRaceDatabase($host, $port, $username, $password, $database);
        } catch (\Throwable $e) {
            $this->mysqlSkipReason = "MySQL race connection failed for {$username}@{$host}:{$port}: ".$e->getMessage();

            return false;
        }

        $config = [
            'driver' => 'mysql',
            'host' => $host,
            'port' => $port,
            'database' => $database,
            'username' => $username,
            'password' => $password,
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'strict' => true,
            'engine' => 'InnoDB',
        ];

        config([
            'database.connections.mysql_rr' => $config,
            'database.connections.mysql_rr_sibling' => $config,
        ]);

        DB::purge('mysql_rr');
        DB::purge('mysql_rr_sibling');

        $this->previousDefault = (string) config('database.default');
        config(['database.default' => 'mysql_rr']);
        DB::setDefaultConnection('mysql_rr');

        DB::connection('mysql_rr')->statement('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        DB::connection('mysql_rr_sibling')->statement('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');

        Artisan::call('migrate:fresh', [
            '--database' => 'mysql_rr',
            '--force' => true,
        ]);

        return true;
    }

    private function ensureMysqlRaceDatabase(string $host, int $port, string $username, string $password, string $database): void
    {
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 3,
        ];
        $serverDsn = sprintf('mysql:host=%s;port=%d', $host, $port);
        $dbDsn = $serverDsn.';dbname='.$database;

        try {
            new PDO($dbDsn, $username, $password, $options);

            return;
        } catch (\Throwable) {
            // Create it, then retry.
        }

        try {
            $pdo = new PDO($serverDsn, $username, $password, $options);
            $pdo->exec('CREATE DATABASE IF NOT EXISTS `'.$database.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        } catch (\Throwable $e) {
            if ($username === 'root') {
                throw $e;
            }

            $root = new PDO($serverDsn, 'root', $password, $options);
            $root->exec('CREATE DATABASE IF NOT EXISTS `'.$database.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
            $root->exec('GRANT ALL PRIVILEGES ON `'.$database.'`.* TO \''.$username.'\'@\'%\'');
            $root->exec('FLUSH PRIVILEGES');
        }

        new PDO($dbDsn, $username, $password, $options);
    }

    private function mysqlRaceValue(string $name, mixed $fallback): string
    {
        $value = getenv($name);
        if (is_string($value) && $value !== '') {
            return $value;
        }

        $fromServer = $_SERVER[$name] ?? $_ENV[$name] ?? null;
        if (is_string($fromServer) && $fromServer !== '') {
            return $fromServer;
        }

        return (string) $fallback;
    }
}
