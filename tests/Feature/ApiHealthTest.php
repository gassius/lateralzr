<?php

namespace Tests\Feature;

use Tests\TestCase;

class ApiHealthTest extends TestCase
{
    /**
     * Test that the hello endpoint returns a successful response.
     */
    public function test_hello_endpoint_returns_successful_response(): void
    {
        $response = $this->getJson('/api/hello');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'status',
            ])
            ->assertJson([
                'status' => 'ok',
            ]);
    }

    /**
     * Test that the hello endpoint returns the correct message.
     */
    public function test_hello_endpoint_returns_correct_message(): void
    {
        $response = $this->getJson('/api/hello');

        $response->assertJson([
            'message' => 'Hello, Lateralzr API is running!',
        ]);
    }
}
