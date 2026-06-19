<?php

declare(strict_types=1);

namespace Cheki;

/**
 * Immutable result object returned by verify() and verifyBatch().
 */
class VerifyResult
{
    public bool $success;

    public bool $verified;

    public ?string $bank;

    public ?string $reference;

    public ?string $senderName;

    public ?string $receiverName;

    public ?string $amount;

    public ?string $currency;

    public ?string $date;

    public ?string $sourceUrl;

    public ?string $error;

    public ?int $httpStatus;

    public ?array $raw;

    public function __construct(
        bool $success,
        bool $verified = false,
        ?string $bank = null,
        ?string $reference = null,
        ?string $senderName = null,
        ?string $receiverName = null,
        ?string $amount = null,
        ?string $currency = null,
        ?string $date = null,
        ?string $sourceUrl = null,
        ?string $error = null,
        ?int $httpStatus = null,
        ?array $raw = null
    ) {
        $this->success       = $success;
        $this->verified      = $verified;
        $this->bank          = $bank;
        $this->reference     = $reference;
        $this->senderName    = $senderName;
        $this->receiverName  = $receiverName;
        $this->amount        = $amount;
        $this->currency      = $currency;
        $this->date          = $date;
        $this->sourceUrl     = $sourceUrl;
        $this->error         = $error;
        $this->httpStatus    = $httpStatus;
        $this->raw           = $raw;
    }

    /**
     * Build a VerifyResult from a decoded JSON response.
     *
     * @param array<string, mixed> $data
     */
    public static function fromResponse(array $data, ?int $httpStatus = null): self
    {
        return new self(
            success:      isset($data['success']) ? (bool) $data['success'] : false,
            verified:     isset($data['verified']) ? (bool) $data['verified'] : false,
            bank:         isset($data['bank']) ? self::toString($data['bank']) : null,
            reference:    isset($data['reference']) ? self::toString($data['reference']) : null,
            senderName:   isset($data['senderName']) ? self::toString($data['senderName']) : null,
            receiverName: isset($data['receiverName']) ? self::toString($data['receiverName']) : null,
            amount:       isset($data['amount']) ? self::toString($data['amount']) : null,
            currency:     isset($data['currency']) ? self::toString($data['currency']) : null,
            date:         isset($data['date']) ? self::toString($data['date']) : null,
            sourceUrl:    isset($data['sourceUrl']) ? self::toString($data['sourceUrl']) : null,
            error:        isset($data['error']) ? self::toString($data['error']) : null,
            httpStatus:   $httpStatus,
            raw:          $data
        );
    }

    /**
     * Create an error result when the request itself fails.
     */
    public static function error(string $message, ?int $httpStatus = null): self
    {
        return new self(
            success:    false,
            verified:   false,
            error:      $message,
            httpStatus: $httpStatus
        );
    }

    /**
     * Whether the receipt was successfully verified.
     */
    public function isVerified(): bool
    {
        return $this->success && $this->verified;
    }

    /**
     * Get the raw decoded response array.
     */
    public function getRaw(): ?array
    {
        return $this->raw;
    }

    /**
     * Safely coerce a value to string|null.
     */
    private static function toString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        return is_scalar($value) ? (string) $value : null;
    }
}
