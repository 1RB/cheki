<?php

declare(strict_types=1);

namespace Cheki;

/**
 * Result of verify(), and of each item in verifyBatch().
 *
 * verify() never throws for API answers: a 4xx/5xx comes back as a result
 * with success false, error and httpStatus set.
 *
 * isVerified() is the ONLY success signal. success true only means the
 * request was processed: a BOA QR code that could not be confirmed with the
 * bank comes back with success true, verified false and decodedOnly true.
 */
class VerifyResult
{
    public bool $success;
    /** True only when the bank itself confirmed the receipt. */
    public bool $verified;
    /** BOA QR only: decrypted but not confirmed with the bank. Never proof of payment. */
    public bool $decodedOnly = false;
    /** /api/parse only: parsed from caller-supplied text, never checked with the bank. */
    public bool $parsed = false;
    public ?string $source = null;
    public ?string $label = null;
    /** True when the server answered from its receipt cache. */
    public bool $cached = false;
    public ?string $bank = null;
    public ?string $bankCode = null;
    public ?string $reference = null;
    public ?string $sourceUrl = null;
    public ?string $senderName = null;
    public ?string $senderAccount = null;
    public ?string $receiverName = null;
    public ?string $receiverAccount = null;
    public ?float $amount = null;
    public ?string $currency = null;
    public ?string $date = null;
    public ?string $branch = null;
    public ?string $reason = null;
    public ?string $transactionType = null;
    public ?int $durationMs = null;
    public ?string $invoiceNumber = null;
    public ?string $transactionStatus = null;
    public ?float $settledAmount = null;
    public ?float $stampDuty = null;
    public ?float $discountAmount = null;
    public ?float $serviceFee = null;
    public ?float $serviceFeeVat = null;
    public ?float $totalPaid = null;
    public ?string $amountInWords = null;
    public ?string $paymentMode = null;
    public ?string $paymentChannel = null;
    public ?string $bankAccountNumber = null;
    public ?string $bankAccountName = null;
    /** Server (or transport) error message. */
    public ?string $error;
    /** For geo-blocked banks: open this link in a browser in Ethiopia instead. */
    public ?string $fallbackUrl = null;
    /** HTTP status of the response (batch items: the status a single verify would have returned). */
    public ?int $httpStatus;
    /** Seconds from the Retry-After header on a 429, when sent. */
    public ?int $retryAfter = null;
    /** Position in the batch input (batch items only). */
    public ?int $index = null;
    /** @var array<string, mixed>|null */
    public ?array $raw = null;

    private const STRING_FIELDS = [
        'source', 'label', 'bank', 'bankCode', 'reference', 'sourceUrl', 'senderName', 'senderAccount',
        'receiverName', 'receiverAccount', 'currency', 'date', 'branch', 'reason', 'transactionType',
        'invoiceNumber', 'transactionStatus', 'amountInWords', 'paymentMode', 'paymentChannel',
        'bankAccountNumber', 'bankAccountName', 'fallbackUrl',
    ];

    private const FLOAT_FIELDS = [
        'amount', 'settledAmount', 'stampDuty', 'discountAmount', 'serviceFee', 'serviceFeeVat', 'totalPaid',
    ];

    public function __construct(bool $success, bool $verified = false, ?string $error = null, ?int $httpStatus = null)
    {
        $this->success    = $success;
        $this->verified   = $verified;
        $this->error      = $error;
        $this->httpStatus = $httpStatus;
    }

    /**
     * Build a VerifyResult from a decoded JSON object.
     *
     * @param array<string, mixed> $data
     */
    public static function fromResponse(array $data, ?int $httpStatus = null, ?int $retryAfter = null): self
    {
        $r = new self(
            ($data['success'] ?? false) === true,
            ($data['verified'] ?? false) === true,
            isset($data['error']) && is_scalar($data['error']) ? (string) $data['error'] : null,
            // A batch item carries its own status.
            isset($data['status']) && is_int($data['status']) ? $data['status'] : $httpStatus
        );
        foreach (self::STRING_FIELDS as $f) {
            if (isset($data[$f]) && is_scalar($data[$f])) {
                $r->{$f} = (string) $data[$f];
            }
        }
        foreach (self::FLOAT_FIELDS as $f) {
            if (isset($data[$f]) && is_numeric($data[$f])) {
                $r->{$f} = (float) $data[$f];
            }
        }
        $r->decodedOnly = ($data['decodedOnly'] ?? false) === true;
        $r->parsed      = ($data['parsed'] ?? false) === true;
        $r->cached      = ($data['cached'] ?? false) === true;
        $r->durationMs  = isset($data['durationMs']) && is_numeric($data['durationMs']) ? (int) $data['durationMs'] : null;
        $r->retryAfter  = $retryAfter;
        $r->raw         = $data;
        return $r;
    }

    /** A result for a request that failed before or outside the API (network, timeout). */
    public static function error(string $message, ?int $httpStatus = null, ?int $retryAfter = null): self
    {
        $r             = new self(false, false, $message, $httpStatus);
        $r->retryAfter = $retryAfter;
        return $r;
    }

    /** True only when the bank confirmed the receipt. decodedOnly and parsed are not proof. */
    public function isVerified(): bool
    {
        return $this->success && $this->verified;
    }

    /** HTTP 429: wait retryAfter seconds (when set) before trying again. */
    public function isRateLimited(): bool
    {
        return $this->httpStatus === 429;
    }

    /** HTTP 413: the request body is over the route's cap. */
    public function isPayloadTooLarge(): bool
    {
        return $this->httpStatus === 413;
    }

    /** @return array<string, mixed>|null */
    public function getRaw(): ?array
    {
        return $this->raw;
    }
}
