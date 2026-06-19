<?php

declare(strict_types=1);

namespace Cheki;

/**
 * Main client for the cheki receipt verification API.
 *
 * Usage:
 *
 *   $client = new ChekiClient();
 *   $result = $client->verify('cbe', 'RB1234567890', '1000123456789');
 *   if ($result->isVerified()) {
 *       echo $result->senderName . ' sent ' . $result->amount . ' ' . $result->currency;
 *   }
 */
class ChekiClient
{
    /** Maximum number of retry attempts for transient failures. */
    private const MAX_RETRIES = 3;

    /** Base delay in milliseconds for exponential backoff. */
    private const BASE_BACKOFF_MS = 200;

    private VerifyOptions $options;

    public function __construct(?VerifyOptions $options = null)
    {
        $this->options = $options ?? new VerifyOptions();
    }

    /**
     * Create a client with a custom base URL.
     */
    public static function withBaseUrl(string $baseUrl): self
    {
        return new self((new VerifyOptions())->withBaseUrl($baseUrl));
    }

    /**
     * Get the current options (immutable clone pattern).
     */
    public function getOptions(): VerifyOptions
    {
        return $this->options;
    }

    // ─── Public API ───────────────────────────────────────────────

    /**
     * Verify a single receipt.
     *
     * @param string      $bank          Bank code (e.g. 'cbe', 'dashen', 'awash').
     * @param string      $reference     Receipt reference number.
     * @param string|null $accountNumber Optional account number.
     * @param string|null $phoneNumber   Optional phone number.
     * @param string|null $qrData        Optional raw QR data string.
     */
    public function verify(
        string $bank,
        string $reference,
        ?string $accountNumber = null,
        ?string $phoneNumber = null,
        ?string $qrData = null
    ): VerifyResult {
        $payload = [
            'bank'      => $bank,
            'reference' => $reference,
        ];

        if ($accountNumber !== null && $accountNumber !== '') {
            $payload['accountNumber'] = $accountNumber;
        }
        if ($phoneNumber !== null && $phoneNumber !== '') {
            $payload['phoneNumber'] = $phoneNumber;
        }
        if ($qrData !== null && $qrData !== '') {
            $payload['qrData'] = $qrData;
        }

        $response = $this->post('/api/verify', $payload);

        if ($response->error !== null) {
            return VerifyResult::error($response->error, $response->httpStatus);
        }

        return VerifyResult::fromResponse($response->data, $response->httpStatus);
    }

    /**
     * Verify a batch of receipts.
     *
     * @param array<int, array{bank: string, reference: string, accountNumber?: string, phoneNumber?: string}> $receipts
     */
    public function verifyBatch(array $receipts): BatchResult
    {
        // Normalize: strip null/empty optional fields
        $clean = [];
        foreach ($receipts as $receipt) {
            $item = [
                'bank'      => $receipt['bank'],
                'reference' => $receipt['reference'],
            ];
            if (isset($receipt['accountNumber']) && $receipt['accountNumber'] !== '') {
                $item['accountNumber'] = $receipt['accountNumber'];
            }
            if (isset($receipt['phoneNumber']) && $receipt['phoneNumber'] !== '') {
                $item['phoneNumber'] = $receipt['phoneNumber'];
            }
            $clean[] = $item;
        }

        $response = $this->post('/api/verify/batch', ['receipts' => $clean]);

        if ($response->error !== null) {
            return BatchResult::error($response->error, $response->httpStatus);
        }

        return BatchResult::fromResponse($response->data, $response->httpStatus);
    }

    /**
     * Get the list of supported banks.
     *
     * @return Bank[]
     */
    public function getBanks(): array
    {
        $response = $this->get('/api/banks');

        if ($response->error !== null) {
            return [];
        }

        $banks = [];
        if (isset($response->data['banks']) && is_array($response->data['banks'])) {
            foreach ($response->data['banks'] as $bankData) {
                if (is_array($bankData)) {
                    $banks[] = Bank::fromArray($bankData);
                }
            }
        }

        return $banks;
    }

    /**
     * Check the health of the cheki API.
     */
    public function getHealth(): HealthStatus
    {
        $response = $this->get('/api/health');

        if ($response->error !== null) {
            return new HealthStatus(
                success: false,
                status: 'unreachable',
                httpStatus: $response->httpStatus,
                raw: ['error' => $response->error]
            );
        }

        return HealthStatus::fromResponse($response->data, $response->httpStatus);
    }

    // ─── Internal HTTP layer ──────────────────────────────────────

    /**
     * Perform a GET request and return decoded JSON.
     *
     * @return object{data: array<string, mixed>, error: ?string, httpStatus: ?int}
     */
    private function get(string $path): object
    {
        return $this->request('GET', $path, null);
    }

    /**
     * Perform a POST request with a JSON body and return decoded JSON.
     *
     * @param array<string, mixed> $payload
     * @return object{data: array<string, mixed>, error: ?string, httpStatus: ?int}
     */
    private function post(string $path, array $payload): object
    {
        return $this->request('POST', $path, $payload);
    }

    /**
     * Core cURL request handler with retry support.
     *
     * Retries up to MAX_RETRIES times on HTTP 429 (Too Many Requests) and
     * 5xx (Server Error) responses using exponential backoff. Network-level
     * cURL errors and non-retryable HTTP status codes are returned immediately.
     *
     * @param string               $method  HTTP method (GET or POST).
     * @param string               $path    API path (e.g. '/api/verify').
     * @param array<string, mixed>|null $payload JSON body for POST.
     * @return object{data: array<string, mixed>, error: ?string, httpStatus: ?int}
     */
    private function request(string $method, string $path, ?array $payload): object
    {
        $url = $this->options->baseUrl . $path;

        $ch = curl_init($url);

        if ($ch === false) {
            return (object) [
                'data'       => [],
                'error'      => 'Failed to initialize cURL',
                'httpStatus' => null,
            ];
        }

        $headers = array_merge([
            'Accept: application/json',
            'User-Agent: ' . $this->options->userAgent,
        ], $this->options->headers);

        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER         => false,
            CURLOPT_TIMEOUT        => $this->options->timeout,
            CURLOPT_CONNECTTIMEOUT => $this->options->connectTimeout,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 5,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ];

        if ($this->options->apiKey !== null && $this->options->apiKey !== '') {
            $headers[] = 'Authorization: Bearer ' . $this->options->apiKey;
        }

        if ($method === 'POST' && $payload !== null) {
            $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
            if ($json === false) {
                curl_close($ch);
                return (object) [
                    'data'       => [],
                    'error'      => 'Failed to encode JSON payload: ' . json_last_error_msg(),
                    'httpStatus' => null,
                ];
            }
            $opts[CURLOPT_POST]       = true;
            $opts[CURLOPT_POSTFIELDS] = $json;
            $headers[] = 'Content-Type: application/json';
            $headers[] = 'Content-Length: ' . strlen($json);
        }

        $opts[CURLOPT_HTTPHEADER] = $headers;
        curl_setopt_array($ch, $opts);

        // Retry loop with exponential backoff for 429 and 5xx responses.
        $attempt = 0;
        while (true) {
            $attempt++;
            $body     = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

            // Network-level failure - not retryable (no HTTP status available).
            if ($body === false) {
                $error = curl_error($ch);
                $errno = curl_errno($ch);
                curl_close($ch);
                return (object) [
                    'data'       => [],
                    'error'      => 'cURL error (' . $errno . '): ' . $error,
                    'httpStatus' => null,
                ];
            }

            $decoded = json_decode((string) $body, true);

            // Check if the HTTP status is retryable (429 or 5xx).
            $isRetryable = $httpCode === 429 || $httpCode >= 500;

            if ($isRetryable && $attempt <= self::MAX_RETRIES) {
                $this->sleepBackoff($attempt);
                continue;
            }

            curl_close($ch);

            if (!is_array($decoded)) {
                return (object) [
                    'data'       => [],
                    'error'      => 'Invalid JSON response (HTTP ' . $httpCode . ')',
                    'httpStatus' => (int) $httpCode,
                ];
            }

            return (object) [
                'data'       => $decoded,
                'error'      => null,
                'httpStatus' => (int) $httpCode,
            ];
        }
    }

    /**
     * Sleep for an exponentially increasing duration before a retry attempt.
     *
     * Uses a base delay of BASE_BACKOFF_MS with exponential doubling:
     * attempt 1 → 200ms, attempt 2 → 400ms, attempt 3 → 800ms.
     *
     * @param int $attempt The current attempt number (1-based).
     */
    private function sleepBackoff(int $attempt): void
    {
        $delayMs = self::BASE_BACKOFF_MS * (2 ** ($attempt - 1));
        usleep($delayMs * 1000);
    }
}
