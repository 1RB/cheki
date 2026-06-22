<?php

declare(strict_types=1);

namespace Cheki;

/**
 * Options for controlling ChekiClient behavior.
 */
class VerifyOptions
{
    /** Base URL of the cheki API (no trailing slash). */
    public string $baseUrl;

    /** Request timeout in seconds. */
    public int $timeout;

    /** Connect timeout in seconds. */
    public int $connectTimeout;

    /** Optional Bearer / custom authorization token. */
    public ?string $apiKey;

    /** Additional HTTP headers to send with every request. */
    public array $headers;

    /** User-Agent string for outgoing requests. */
    public string $userAgent;

    public function __construct()
    {
        $this->baseUrl         = 'https://chekiapp.vercel.app';
        $this->timeout         = 30;
        $this->connectTimeout  = 10;
        $this->apiKey          = null;
        $this->headers         = [];
        $this->userAgent       = 'cheki-php-sdk/1.0.0';
    }

    /**
     * Create a copy with a different base URL.
     */
    public function withBaseUrl(string $baseUrl): self
    {
        $clone              = clone $this;
        $clone->baseUrl     = rtrim($baseUrl, '/');
        return $clone;
    }

    /**
     * Create a copy with a different request timeout.
     */
    public function withTimeout(int $timeout): self
    {
        $clone           = clone $this;
        $clone->timeout  = $timeout;
        return $clone;
    }

    /**
     * Create a copy with an API key.
     */
    public function withApiKey(?string $apiKey): self
    {
        $clone          = clone $this;
        $clone->apiKey  = $apiKey;
        return $clone;
    }

    /**
     * Create a copy with extra HTTP headers.
     *
     * @param array<string, string> $headers
     */
    public function withHeaders(array $headers): self
    {
        $clone          = clone $this;
        $clone->headers = array_merge($this->headers, $headers);
        return $clone;
    }
}
