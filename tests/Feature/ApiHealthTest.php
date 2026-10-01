<?php

namespace Tests\Feature;

use Tests\TestCase;

class ApiHealthTest extends TestCase
{
    public function test_hello_endpoint_returns_ok_payload(): void
    {
        $response = $this->getJson('/api/hello');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'status',
            ])
            ->assertJson([
                'status' => 'ok',
                'message' => 'Hello, Lateralzr API is running!',
            ]);
    }

    public function test_root_returns_no_content(): void
    {
        $this->get('/')->assertNoContent();
    }

    public function test_up_health_endpoint_returns_ok(): void
    {
        $this->get('/up')->assertOk();
    }
}
