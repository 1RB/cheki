<?php

declare(strict_types=1);

namespace Cheki;

/**
 * Options for controlling ChekiClient behavior.
 */
class VerifyOptions
{
    /** SDK version, sent in the User-Agent header. */
    public const VERSION = '1.6.0';

    /**
     * Default per-attempt timeout in seconds. The server gives a verification
     * up to 60 s, so the client waits a little longer.
     */
    public const DEFAULT_TIMEOUT = 65;

    /**
     * Most retries on top of the first attempt. The server already makes up
     * to 2 attempts per bank fetch, so one SDK call reaches a bank at most
     * 2 x 2 = 4 times.
     */
    public const MAX_RETRIES = 1;

    /** Base URL of the cheki API (no trailing slash). */
    public string $baseUrl;

    /** Per-attempt timeout in seconds. */
    public int $timeout;

    /** Connect timeout in seconds. */
    public int $connectTimeout;

    /** Retries where a retry is safe (0 or 1; see ChekiClient). */
    public int $maxRetries;

    /** Optional Bearer token. The public API does not need one. */
    public ?string $apiKey;

    /** @var string[] Additional HTTP headers ("Name: value") sent with every request. */
    public array $headers;

    /** User-Agent string for outgoing requests. */
    public string $userAgent;

    public function __construct()
    {
        $this->baseUrl        = 'https://cheki.et';
        $this->timeout        = self::DEFAULT_TIMEOUT;
        $this->connectTimeout = 10;
        $this->maxRetries     = self::MAX_RETRIES;
        $this->apiKey         = null;
        $this->headers        = [];
        $this->userAgent      = 'cheki-php-sdk/' . self::VERSION;
    }

    /** Create a copy with a different base URL. */
    public function withBaseUrl(string $baseUrl): self
    {
        $clone          = clone $this;
        $clone->baseUrl = rtrim($baseUrl, '/');
        return $clone;
    }

    /** Create a copy with a different per-attempt timeout (seconds). */
    public function withTimeout(int $timeout): self
    {
        $clone          = clone $this;
        $clone->timeout = $timeout;
        return $clone;
    }

    /** Create a copy with a different retry count (clamped to 0..1). */
    public function withMaxRetries(int $maxRetries): self
    {
        $clone             = clone $this;
        $clone->maxRetries = max(0, min(self::MAX_RETRIES, $maxRetries));
        return $clone;
    }

    /** Create a copy with an API key. */
    public function withApiKey(?string $apiKey): self
    {
        $clone         = clone $this;
        $clone->apiKey = $apiKey;
        return $clone;
    }

    /**
     * Create a copy with extra HTTP headers.
     *
     * @param string[] $headers Lines like "X-Custom: value".
     */
    public function withHeaders(array $headers): self
    {
        $clone          = clone $this;
        $clone->headers = array_merge($this->headers, $headers);
        return $clone;
    }
}
