<?php

declare(strict_types=1);

namespace Cheki;

/**
 * Thrown by getBanks() and getHealth() when the request fails. (verify()
 * and verifyBatch() return result objects with the error instead.)
 */
class ChekiException extends \RuntimeException
{
    /** HTTP status, or null for a network error or timeout. */
    public ?int $httpStatus;
    /** Seconds from the Retry-After header on a 429, when sent. */
    public ?int $retryAfter;

    public function __construct(string $message, ?int $httpStatus = null, ?int $retryAfter = null)
    {
        parent::__construct($message, $httpStatus ?? 0);
        $this->httpStatus = $httpStatus;
        $this->retryAfter = $retryAfter;
    }

    public function isRateLimited(): bool
    {
        return $this->httpStatus === 429;
    }
}
