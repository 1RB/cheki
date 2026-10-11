<?php

declare(strict_types=1);

namespace Cheki;

/**
 * A supported bank or wallet from GET /api/banks.
 */
class Bank
{
    /** Bank id, the value to pass as $bank to verify() (e.g. 'cbe'). */
    public string $id;
    /** @deprecated Use $id. Kept as an alias with the same value. */
    public string $code;
    public ?string $name;
    public ?string $swift;
    /** 'bank', 'mobile' or 'wallet'. */
    public ?string $type;
    /** 'live' or 'in-development'. */
    public ?string $status;
    public bool $requiresAccount;
    /** Trailing account digits the bank needs, when it needs an account. */
    public ?int $accountDigits;
    public bool $requiresPhone;
    public ?string $endpoint;
    public ?string $color;
    public ?string $initials;
    /** @var array<string, mixed>|null */
    public ?array $raw;

    /** @param array<string, mixed>|null $raw */
    public function __construct(
        string $id = '',
        ?string $name = null,
        ?string $status = null,
        ?string $type = null,
        bool $requiresAccount = false,
        ?int $accountDigits = null,
        bool $requiresPhone = false,
        ?string $endpoint = null,
        ?string $color = null,
        ?string $initials = null,
        ?string $swift = null,
        ?array $raw = null
    ) {
        $this->id              = $id;
        $this->code            = $id;
        $this->name            = $name;
        $this->status          = $status;
        $this->type            = $type;
        $this->requiresAccount = $requiresAccount;
        $this->accountDigits   = $accountDigits;
        $this->requiresPhone   = $requiresPhone;
        $this->endpoint        = $endpoint;
        $this->color           = $color;
        $this->initials        = $initials;
        $this->swift           = $swift;
        $this->raw             = $raw;
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $str = static fn (string $k): ?string => isset($data[$k]) && is_scalar($data[$k]) ? (string) $data[$k] : null;
        return new self(
            id:              (string) ($str('id') ?? $str('code') ?? ''),
            name:            $str('name'),
            status:          $str('status'),
            type:            $str('type'),
            requiresAccount: ($data['requiresAccount'] ?? false) === true,
            accountDigits:   isset($data['accountDigits']) && is_numeric($data['accountDigits']) ? (int) $data['accountDigits'] : null,
            requiresPhone:   ($data['requiresPhone'] ?? false) === true,
            endpoint:        $str('endpoint'),
            color:           $str('color'),
            initials:        $str('initials'),
            swift:           $str('swift'),
            raw:             $data
        );
    }

    public function isLive(): bool
    {
        return $this->status === 'live';
    }

    public function isBank(): bool
    {
        return $this->type === 'bank';
    }

    /** Mobile money (Telebirr, M-Pesa, eBirr). */
    public function isMobile(): bool
    {
        return $this->type === 'mobile';
    }

    public function isWallet(): bool
    {
        return $this->type === 'wallet';
    }
}
