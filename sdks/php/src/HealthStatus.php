<?php

declare(strict_types=1);

namespace Cheki;

/**
 * GET /api/health: per-bank reachability, cached up to 5 minutes server-side.
 */
class HealthStatus
{
    public ?string $status;
    /** When the probe ran (ISO 8601). */
    public ?string $checkedAt;
    /** True when the server answered from its 5-minute cache. */
    public bool $cached;
    /** @var BankHealth[] */
    public array $banks;
    public ?int $httpStatus;
    /** @var array<string, mixed>|null */
    public ?array $raw;

    /**
     * @param BankHealth[] $banks
     * @param array<string, mixed>|null $raw
     */
    public function __construct(
        ?string $status = null,
        ?string $checkedAt = null,
        bool $cached = false,
        array $banks = [],
        ?int $httpStatus = null,
        ?array $raw = null
    ) {
        $this->status     = $status;
        $this->checkedAt  = $checkedAt;
        $this->cached     = $cached;
        $this->banks      = $banks;
        $this->httpStatus = $httpStatus;
        $this->raw        = $raw;
    }

    /** @param array<string, mixed> $data */
    public static function fromResponse(array $data, ?int $httpStatus = null): self
    {
        $banks = [];
        if (isset($data['banks']) && is_array($data['banks'])) {
            foreach ($data['banks'] as $b) {
                if (is_array($b)) {
                    $banks[] = BankHealth::fromArray($b);
                }
            }
        }
        return new self(
            status:     isset($data['status']) && is_scalar($data['status']) ? (string) $data['status'] : null,
            checkedAt:  isset($data['checkedAt']) && is_scalar($data['checkedAt']) ? (string) $data['checkedAt'] : null,
            cached:     ($data['cached'] ?? false) === true,
            banks:      $banks,
            httpStatus: $httpStatus,
            raw:        $data
        );
    }

    /** The service answered with status "ok". Individual banks may still be unreachable. */
    public function isHealthy(): bool
    {
        return $this->status === 'ok';
    }
}
