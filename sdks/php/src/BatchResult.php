<?php

declare(strict_types=1);

namespace Cheki;

/**
 * Result of a batch verification call.
 */
class BatchResult
{
    public bool $success;
    public int $total;
    /** Items with verified true. */
    public int $verified;
    /** Everything else: errors and decoded-only QR results. */
    public int $failed;
    /** Items served from the server cache. */
    public int $cached;
    /** @var VerifyResult[] In input order; each has $index set. */
    public array $results;
    public ?string $error;
    public ?int $httpStatus;
    /** Seconds from the Retry-After header on a 429, when sent. */
    public ?int $retryAfter = null;
    /** @var array<string, mixed>|null */
    public ?array $raw;

    /**
     * @param VerifyResult[] $results
     * @param array<string, mixed>|null $raw
     */
    public function __construct(
        bool $success,
        int $total = 0,
        int $verified = 0,
        int $failed = 0,
        array $results = [],
        ?string $error = null,
        ?int $httpStatus = null,
        ?array $raw = null,
        int $cached = 0
    ) {
        $this->success    = $success;
        $this->total      = $total;
        $this->verified   = $verified;
        $this->failed     = $failed;
        $this->results    = $results;
        $this->error      = $error;
        $this->httpStatus = $httpStatus;
        $this->raw        = $raw;
        $this->cached     = $cached;
    }

    /**
     * Build from a decoded JSON response.
     *
     * @param array<string, mixed> $data
     */
    public static function fromResponse(array $data, ?int $httpStatus = null, ?int $retryAfter = null): self
    {
        $results = [];
        if (isset($data['results']) && is_array($data['results'])) {
            foreach (array_values($data['results']) as $i => $item) {
                if (is_array($item)) {
                    $r        = VerifyResult::fromResponse($item);
                    $r->index = $i;
                    $results[] = $r;
                }
            }
        }
        $verified = count(array_filter($results, fn (VerifyResult $r): bool => $r->isVerified()));

        $batch = new self(
            success:    ($data['success'] ?? false) === true,
            total:      isset($data['total']) && is_int($data['total']) ? $data['total'] : count($results),
            verified:   isset($data['verified']) && is_int($data['verified']) ? $data['verified'] : $verified,
            failed:     isset($data['failed']) && is_int($data['failed']) ? $data['failed'] : count($results) - $verified,
            results:    $results,
            error:      isset($data['error']) && is_scalar($data['error']) ? (string) $data['error'] : null,
            httpStatus: $httpStatus,
            raw:        $data,
            cached:     isset($data['cached']) && is_int($data['cached']) ? $data['cached'] : 0
        );
        $batch->retryAfter = $retryAfter;
        return $batch;
    }

    public static function error(string $message, ?int $httpStatus = null, ?int $retryAfter = null): self
    {
        $batch             = new self(success: false, error: $message, httpStatus: $httpStatus);
        $batch->retryAfter = $retryAfter;
        return $batch;
    }

    /** HTTP 429 for the whole batch. */
    public function isRateLimited(): bool
    {
        return $this->httpStatus === 429;
    }

    /** HTTP 413 for the whole batch (body over 64 KB). */
    public function isPayloadTooLarge(): bool
    {
        return $this->httpStatus === 413;
    }

    /** @return VerifyResult[] Only the items the bank confirmed. */
    public function getVerified(): array
    {
        return array_values(array_filter($this->results, fn (VerifyResult $r): bool => $r->isVerified()));
    }

    /** @return VerifyResult[] Everything not verified (errors and decoded-only results). */
    public function getFailed(): array
    {
        return array_values(array_filter($this->results, fn (VerifyResult $r): bool => !$r->isVerified()));
    }
}
