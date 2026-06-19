<?php

declare(strict_types=1);

namespace Cheki;

/**
 * Represents a supported bank returned by GET /api/banks.
 */
class Bank
{
    public ?string $code;
    public ?string $name;
    public ?string $status;
    public bool $requiresAccount;

    /** @var array<string, mixed> */
    public ?array $raw;

    public function __construct(
        ?string $code = null,
        ?string $name = null,
        ?string $status = null,
        bool $requiresAccount = false,
        ?array $raw = null
    ) {
        $this->code           = $code;
        $this->name           = $name;
        $this->status         = $status;
        $this->requiresAccount = $requiresAccount;
        $this->raw            = $raw;
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            code:            isset($data['code']) ? (string) $data['code'] : null,
            name:            isset($data['name']) ? (string) $data['name'] : null,
            status:          isset($data['status']) ? (string) $data['status'] : null,
            requiresAccount: isset($data['requiresAccount']) ? (bool) $data['requiresAccount'] : false,
            raw:             $data
        );
    }

    /**
     * Whether this bank is currently active/available.
     */
    public function isActive(): bool
    {
        return $this->status === 'active' || $this->status === 'online';
    }
}
