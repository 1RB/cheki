<?php

declare(strict_types=1);

namespace Cheki;

/**
 * Represents the health-check response from GET /api/health.
 */
class HealthStatus
{
    public bool $success;

    public ?string $status;

    public ?string $version;

    public ?string $timestamp;

    /** @var array<string, mixed> */
    public ?array $checks;

    public ?int $httpStatus;

    public ?array $raw;

    public function __construct(
        bool $success,
        ?string $status = null,
        ?string $version = null,
        ?string $timestamp = null,
        ?array $checks = null,
        ?int $httpStatus = null,
        ?array $raw = null
    ) {
        $this->success   = $success;
        $this->status    = $status;
        $this->version   = $version;
        $this->timestamp = $timestamp;
        $this->checks    = $checks;
        $this->httpStatus = $httpStatus;
        $this->raw       = $raw;
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromResponse(array $data, ?int $httpStatus = null): self
    {
        return new self(
            success:   isset($data['success']) ? (bool) $data['success'] : false,
            status:    isset($data['status']) ? (string) $data['status'] : null,
            version:   isset($data['version']) ? (string) $data['version'] : null,
            timestamp: isset($data['timestamp']) ? (string) $data['timestamp'] : null,
            checks:    isset($data['checks']) && is_array($data['checks']) ? $data['checks'] : null,
            httpStatus: $httpStatus,
            raw:       $data
        );
    }

    /**
     * Whether the service reports a healthy status.
     */
    public function isHealthy(): bool
    {
        return $this->success && ($this->status === 'ok' || $this->status === 'healthy');
    }
}
