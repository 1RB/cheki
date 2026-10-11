<?php

declare(strict_types=1);

namespace Cheki;

/**
 * One bank's reachability in GET /api/health.
 */
class BankHealth
{
    public string $id;
    public string $name;
    /** reachable, unreachable, geo-blocked, no-parser or in-development. */
    public string $status;
    public int $latencyMs;

    public function __construct(string $id, string $name, string $status, int $latencyMs)
    {
        $this->id        = $id;
        $this->name      = $name;
        $this->status    = $status;
        $this->latencyMs = $latencyMs;
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self(
            isset($data['id']) && is_scalar($data['id']) ? (string) $data['id'] : '',
            isset($data['name']) && is_scalar($data['name']) ? (string) $data['name'] : '',
            isset($data['status']) && is_scalar($data['status']) ? (string) $data['status'] : '',
            isset($data['latencyMs']) && is_numeric($data['latencyMs']) ? (int) $data['latencyMs'] : 0
        );
    }

    public function isReachable(): bool
    {
        return $this->status === 'reachable';
    }
}
