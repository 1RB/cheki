<?php

declare(strict_types=1);

namespace Cheki;

/**
 * Immutable result object returned by verify() and verifyBatch().
 *
 * Mirrors the full VerifyResult response from the cheki API, including
 * all optional transaction detail fields.
 */
class VerifyResult
{
    public bool $success;

    public bool $verified;

    public ?string $bank;

    public ?string $bankCode;

    public ?string $reference;

    public ?string $sourceUrl;

    public ?string $senderName;

    public ?string $senderAccount;

    public ?string $receiverName;

    public ?string $receiverAccount;

    public ?string $amount;

    public ?string $currency;

    public ?string $date;

    public ?string $branch;

    public ?string $reason;

    public ?int $durationMs;

    public ?string $invoiceNumber;

    public ?string $transactionStatus;

    public ?string $settledAmount;

    public ?string $stampDuty;

    public ?string $discountAmount;

    public ?string $serviceFee;

    public ?string $serviceFeeVat;

    public ?string $totalPaid;

    public ?string $amountInWords;

    public ?string $paymentMode;

    public ?string $paymentChannel;

    public ?string $bankAccountNumber;

    public ?string $bankAccountName;

    public ?string $error;

    public ?int $httpStatus;

    public ?array $raw;

    /**
     * @param array<string, mixed>|null $raw
     */
    public function __construct(
        bool $success,
        bool $verified = false,
        ?string $bank = null,
        ?string $bankCode = null,
        ?string $reference = null,
        ?string $sourceUrl = null,
        ?string $senderName = null,
        ?string $senderAccount = null,
        ?string $receiverName = null,
        ?string $receiverAccount = null,
        ?string $amount = null,
        ?string $currency = null,
        ?string $date = null,
        ?string $branch = null,
        ?string $reason = null,
        ?int $durationMs = null,
        ?string $invoiceNumber = null,
        ?string $transactionStatus = null,
        ?string $settledAmount = null,
        ?string $stampDuty = null,
        ?string $discountAmount = null,
        ?string $serviceFee = null,
        ?string $serviceFeeVat = null,
        ?string $totalPaid = null,
        ?string $amountInWords = null,
        ?string $paymentMode = null,
        ?string $paymentChannel = null,
        ?string $bankAccountNumber = null,
        ?string $bankAccountName = null,
        ?string $error = null,
        ?int $httpStatus = null,
        ?array $raw = null
    ) {
        $this->success            = $success;
        $this->verified           = $verified;
        $this->bank               = $bank;
        $this->bankCode           = $bankCode;
        $this->reference          = $reference;
        $this->sourceUrl          = $sourceUrl;
        $this->senderName         = $senderName;
        $this->senderAccount      = $senderAccount;
        $this->receiverName       = $receiverName;
        $this->receiverAccount    = $receiverAccount;
        $this->amount             = $amount;
        $this->currency           = $currency;
        $this->date               = $date;
        $this->branch             = $branch;
        $this->reason             = $reason;
        $this->durationMs         = $durationMs;
        $this->invoiceNumber      = $invoiceNumber;
        $this->transactionStatus  = $transactionStatus;
        $this->settledAmount      = $settledAmount;
        $this->stampDuty          = $stampDuty;
        $this->discountAmount     = $discountAmount;
        $this->serviceFee         = $serviceFee;
        $this->serviceFeeVat      = $serviceFeeVat;
        $this->totalPaid          = $totalPaid;
        $this->amountInWords      = $amountInWords;
        $this->paymentMode        = $paymentMode;
        $this->paymentChannel     = $paymentChannel;
        $this->bankAccountNumber  = $bankAccountNumber;
        $this->bankAccountName    = $bankAccountName;
        $this->error              = $error;
        $this->httpStatus         = $httpStatus;
        $this->raw                = $raw;
    }

    /**
     * Build a VerifyResult from a decoded JSON response.
     *
     * @param array<string, mixed> $data
     */
    public static function fromResponse(array $data, ?int $httpStatus = null): self
    {
        return new self(
            success:           isset($data['success']) ? (bool) $data['success'] : false,
            verified:          isset($data['verified']) ? (bool) $data['verified'] : false,
            bank:              isset($data['bank']) ? self::toString($data['bank']) : null,
            bankCode:          isset($data['bankCode']) ? self::toString($data['bankCode']) : null,
            reference:         isset($data['reference']) ? self::toString($data['reference']) : null,
            sourceUrl:         isset($data['sourceUrl']) ? self::toString($data['sourceUrl']) : null,
            senderName:        isset($data['senderName']) ? self::toString($data['senderName']) : null,
            senderAccount:     isset($data['senderAccount']) ? self::toString($data['senderAccount']) : null,
            receiverName:      isset($data['receiverName']) ? self::toString($data['receiverName']) : null,
            receiverAccount:   isset($data['receiverAccount']) ? self::toString($data['receiverAccount']) : null,
            amount:            isset($data['amount']) ? self::toString($data['amount']) : null,
            currency:          isset($data['currency']) ? self::toString($data['currency']) : null,
            date:              isset($data['date']) ? self::toString($data['date']) : null,
            branch:            isset($data['branch']) ? self::toString($data['branch']) : null,
            reason:            isset($data['reason']) ? self::toString($data['reason']) : null,
            durationMs:        isset($data['durationMs']) ? self::toInt($data['durationMs']) : null,
            invoiceNumber:     isset($data['invoiceNumber']) ? self::toString($data['invoiceNumber']) : null,
            transactionStatus: isset($data['transactionStatus']) ? self::toString($data['transactionStatus']) : null,
            settledAmount:     isset($data['settledAmount']) ? self::toString($data['settledAmount']) : null,
            stampDuty:         isset($data['stampDuty']) ? self::toString($data['stampDuty']) : null,
            discountAmount:    isset($data['discountAmount']) ? self::toString($data['discountAmount']) : null,
            serviceFee:        isset($data['serviceFee']) ? self::toString($data['serviceFee']) : null,
            serviceFeeVat:     isset($data['serviceFeeVat']) ? self::toString($data['serviceFeeVat']) : null,
            totalPaid:         isset($data['totalPaid']) ? self::toString($data['totalPaid']) : null,
            amountInWords:     isset($data['amountInWords']) ? self::toString($data['amountInWords']) : null,
            paymentMode:       isset($data['paymentMode']) ? self::toString($data['paymentMode']) : null,
            paymentChannel:    isset($data['paymentChannel']) ? self::toString($data['paymentChannel']) : null,
            bankAccountNumber: isset($data['bankAccountNumber']) ? self::toString($data['bankAccountNumber']) : null,
            bankAccountName:   isset($data['bankAccountName']) ? self::toString($data['bankAccountName']) : null,
            error:             isset($data['error']) ? self::toString($data['error']) : null,
            httpStatus:        $httpStatus,
            raw:               $data
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

    /**
     * Safely coerce a value to int|null.
     */
    private static function toInt(mixed $value): ?int
    {
        if ($value === null) {
            return null;
        }
        return is_numeric($value) ? (int) $value : null;
    }
}
