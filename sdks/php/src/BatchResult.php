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

    public int $verified;

    public int $failed;

    /** @var VerifyResult[] */
    public array $results;

    public ?string $error;

    public ?int $httpStatus;

    public ?array $raw;

    /**
     * @param VerifyResult[] $results
     */
    public function __construct(
        bool $success,
        int $total = 0,
        int $verified = 0,
        int $failed = 0,
        array $results = [],
        ?string $error = null,
        ?int $httpStatus = null,
        ?array $raw = null
    ) {
        $this->success    = $success;
        $this->total      = $total;
        $this->verified   = $verified;
        $this->failed     = $failed;
        $this->results    = $results;
        $this->error      = $error;
        $this->httpStatus = $httpStatus;
        $this->raw        = $raw;
    }

    /**
     * Build from a decoded JSON response.
     *
     * @param array<string, mixed> $data
     */
    public static function fromResponse(array $data, ?int $httpStatus = null): self
    {
        $results = [];
        if (isset($data['results']) && is_array($data['results'])) {
            foreach ($data['results'] as $item) {
                if (is_array($item)) {
                    $results[] = VerifyResult::fromResponse($item);
                }
            }
        }

        return new self(
            success:    isset($data['success']) ? (bool) $data['success'] : false,
            total:      isset($data['total']) ? (int) $data['total'] : count($results),
            verified:   isset($data['verified']) ? (int) $data['verified'] : 0,
            failed:     isset($data['failed']) ? (int) $data['failed'] : 0,
            results:    $results,
            error:      isset($data['error']) ? (string) $data['error'] : null,
            httpStatus: $httpStatus,
            raw:        $data
        );
    }

    public static function error(string $message, ?int $httpStatus = null): self
    {
        return new self(
            success:    false,
            error:      $message,
            httpStatus: $httpStatus
        );
    }

    /**
     * Convenience: iterate only verified results.
     *
     * @return VerifyResult[]
     */
    public function getVerified(): array
    {
        return array_values(array_filter(
            $this->results,
            fn (VerifyResult $r): bool => $r->isVerified()
        ));
    }

    /**
     * Convenience: iterate only failed results.
     *
     * @return VerifyResult[]
     */
    public function getFailed(): array
    {
        return array_values(array_filter(
            $this->results,
            fn (VerifyResult $r): bool => !$r->isVerified()
        ));
    }
}
