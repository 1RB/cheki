<?php

declare(strict_types=1);

namespace Cheki;

/**
 * Represents a supported bank returned by GET /api/banks.
 *
 * Mirrors the full BankInfo response from the cheki API.
 */
class Bank
{
    public ?string $code;
    public ?string $name;
    public ?string $status;
    public ?string $type;
    public bool $requiresAccount;
    public ?int $accountDigits;
    public bool $requiresPhone;
    public ?string $responseType;
    public ?string $endpoint;
    public bool $sslVerify;
    public ?string $notes;
    public ?string $color;
    public ?string $initials;

    /** @var array<string, mixed> */
    public ?array $raw;

    public function __construct(
        ?string $code = null,
        ?string $name = null,
        ?string $status = null,
        ?string $type = null,
        bool $requiresAccount = false,
        ?int $accountDigits = null,
        bool $requiresPhone = false,
        ?string $responseType = null,
        ?string $endpoint = null,
        bool $sslVerify = true,
        ?string $notes = null,
        ?string $color = null,
        ?string $initials = null,
        ?array $raw = null
    ) {
        $this->code             = $code;
        $this->name             = $name;
        $this->status           = $status;
        $this->type             = $type;
        $this->requiresAccount  = $requiresAccount;
        $this->accountDigits    = $accountDigits;
        $this->requiresPhone    = $requiresPhone;
        $this->responseType     = $responseType;
        $this->endpoint         = $endpoint;
        $this->sslVerify        = $sslVerify;
        $this->notes            = $notes;
        $this->color            = $color;
        $this->initials         = $initials;
        $this->raw              = $raw;
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
            type:            isset($data['type']) ? (string) $data['type'] : null,
            requiresAccount: isset($data['requiresAccount']) ? (bool) $data['requiresAccount'] : false,
            accountDigits:   isset($data['accountDigits']) ? (int) $data['accountDigits'] : null,
            requiresPhone:   isset($data['requiresPhone']) ? (bool) $data['requiresPhone'] : false,
            responseType:    isset($data['responseType']) ? (string) $data['responseType'] : null,
            endpoint:        isset($data['endpoint']) ? (string) $data['endpoint'] : null,
            sslVerify:       isset($data['sslVerify']) ? (bool) $data['sslVerify'] : true,
            notes:           isset($data['notes']) ? (string) $data['notes'] : null,
            color:           isset($data['color']) ? (string) $data['color'] : null,
            initials:        isset($data['initials']) ? (string) $data['initials'] : null,
            raw:             $data
        );
    }

    /**
     * Whether this bank is currently live and available.
     */
    public function isLive(): bool
    {
        return $this->status === 'live';
    }

    /**
     * Whether this bank is currently active/available.
     */
    public function isActive(): bool
    {
        return $this->status === 'live' || $this->status === 'active' || $this->status === 'online';
    }

    /**
     * Whether this is a bank (as opposed to a wallet).
     */
    public function isBank(): bool
    {
        return $this->type === 'bank';
    }

    /**
     * Whether this is a wallet (as opposed to a bank).
     */
    public function isWallet(): bool
    {
        return $this->type === 'wallet';
    }
}
