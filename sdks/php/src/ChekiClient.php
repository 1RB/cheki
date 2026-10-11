<?php

declare(strict_types=1);

namespace Cheki;

/**
 * Client for the cheki receipt verification API.
 *
 *   $client = new ChekiClient();
 *   $result = $client->verify('cbe', 'FT26140P01YB', '1000560536171');
 *   if ($result->isVerified()) {
 *       echo $result->senderName . ' sent ' . $result->amount . ' ' . $result->currency;
 *   }
 *
 * isVerified() is the only success signal. verify() and verifyBatch() never
 * throw for API answers; getBanks() and getHealth() throw ChekiException.
 *
 * Retries: at most one, on network errors, 5xx and 429 (waiting out a
 * Retry-After of up to 60 s). Other 4xx and timeouts are never retried.
 */
class ChekiClient
{
    /** Maximum receipts per batch, enforced client-side. */
    public const MAX_BATCH_SIZE = 20;

    /** Banks /api/receipt can download => account digits needed (0 = none). */
    public const RECEIPT_DOWNLOAD_BANKS = ['cbe' => 8, 'zemen' => 0, 'dashen' => 0];

    /** A Retry-After longer than this (seconds) is not waited out. */
    private const MAX_RETRY_AFTER = 60;

    private VerifyOptions $options;

    /** @var callable(string, string, string[], ?string, VerifyOptions): array{status: int, headers: array<string, string>, body: string} */
    private $transport;

    /**
     * @param callable|null $transport Optional HTTP transport, mainly for tests:
     *   fn(string $method, string $url, string[] $headers, ?string $body, VerifyOptions $o): array{status, headers, body}.
     *   Header names must be lowercase. Throw TransportException when there is no response.
     */
    public function __construct(?VerifyOptions $options = null, ?callable $transport = null)
    {
        $this->options   = $options ?? new VerifyOptions();
        $this->transport = $transport ?? [self::class, 'curlTransport'];
    }

    public static function withBaseUrl(string $baseUrl): self
    {
        return new self((new VerifyOptions())->withBaseUrl($baseUrl));
    }

    public function getOptions(): VerifyOptions
    {
        return $this->options;
    }

    // ─── Public API ───────────────────────────────────────────────

    /**
     * Verify a single receipt.
     *
     * @param string      $bank          Bank id (e.g. 'cbe', 'telebirr', 'boa').
     * @param string      $reference     Reference or receipt link. '' with $qrData for QR-only.
     * @param string|null $accountNumber Receiving account (CBE, BOA).
     * @param string|null $phoneNumber   Payer phone (CBE Birr).
     * @param string|null $qrData        Raw QR payload (BOA QR codes).
     */
    public function verify(
        string $bank,
        string $reference,
        ?string $accountNumber = null,
        ?string $phoneNumber = null,
        ?string $qrData = null
    ): VerifyResult {
        $payload = self::cleanReceipt([
            'bank'          => $bank,
            'reference'     => $reference,
            'accountNumber' => $accountNumber,
            'phoneNumber'   => $phoneNumber,
            'qrData'        => $qrData,
        ]);

        $response = $this->request('POST', '/api/verify', $payload);
        if ($response['data'] === null) {
            return VerifyResult::error($response['error'] ?? 'Request failed', $response['status'], $response['retryAfter']);
        }
        return VerifyResult::fromResponse($response['data'], $response['status'], $response['retryAfter']);
    }

    /**
     * Verify up to 20 receipts. Each item also counts against the per-IP
     * verify limit (30 per minute).
     *
     * @param array<int, array{bank: string, reference?: string, accountNumber?: string, phoneNumber?: string, qrData?: string}> $receipts
     * @throws \InvalidArgumentException For an empty batch or more than 20 receipts (no request is made).
     */
    public function verifyBatch(array $receipts): BatchResult
    {
        if (count($receipts) === 0) {
            throw new \InvalidArgumentException('verifyBatch needs at least one receipt.');
        }
        if (count($receipts) > self::MAX_BATCH_SIZE) {
            throw new \InvalidArgumentException(sprintf(
                'verifyBatch accepts at most %d receipts (got %d). Split the list into chunks of %d.',
                self::MAX_BATCH_SIZE,
                count($receipts),
                self::MAX_BATCH_SIZE
            ));
        }

        $clean = [];
        foreach ($receipts as $receipt) {
            $clean[] = self::cleanReceipt([
                'bank'          => $receipt['bank'] ?? '',
                'reference'     => $receipt['reference'] ?? null,
                'accountNumber' => $receipt['accountNumber'] ?? null,
                'phoneNumber'   => $receipt['phoneNumber'] ?? null,
                'qrData'        => $receipt['qrData'] ?? null,
            ]);
        }

        $response = $this->request('POST', '/api/verify/batch', ['receipts' => $clean]);
        if ($response['data'] === null || ($response['status'] ?? 0) >= 400) {
            return BatchResult::error(
                $response['error'] ?? (string) ($response['data']['error'] ?? 'Request failed'),
                $response['status'],
                $response['retryAfter']
            );
        }
        return BatchResult::fromResponse($response['data'], $response['status'], $response['retryAfter']);
    }

    /**
     * Supported banks. Bank::$id is the value to pass as $bank.
     *
     * @return Bank[]
     * @throws ChekiException When the request fails (it used to return [] silently).
     */
    public function getBanks(): array
    {
        $data  = $this->requestOrThrow('/api/banks');
        $banks = [];
        foreach (is_array($data['banks'] ?? null) ? $data['banks'] : [] as $bankData) {
            if (is_array($bankData)) {
                $banks[] = Bank::fromArray($bankData);
            }
        }
        return $banks;
    }

    /**
     * Per-bank reachability (cached up to 5 minutes server-side).
     *
     * @throws ChekiException When the request fails.
     */
    public function getHealth(): HealthStatus
    {
        return HealthStatus::fromResponse($this->requestOrThrow('/api/health'), 200);
    }

    /**
     * URL of GET /api/receipt, which downloads the bank's receipt file. Only
     * CBE (needs the account number, at least its last 8 digits), Zemen and
     * Dashen are supported. No request is made.
     *
     * @throws \InvalidArgumentException For an unsupported bank, a bad reference or a missing CBE account.
     */
    public function getReceiptUrl(string $bank, string $reference, ?string $accountNumber = null): string
    {
        $id = strtolower(trim($bank));
        if (!array_key_exists($id, self::RECEIPT_DOWNLOAD_BANKS)) {
            throw new \InvalidArgumentException('Receipt download is only supported for: cbe, zemen, dashen.');
        }
        $ref = trim($reference);
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/', $ref) || str_contains($ref, '..')) {
            throw new \InvalidArgumentException('reference must be 1-64 letters, digits, dots, dashes or underscores.');
        }
        $params = ['bank' => $id, 'reference' => $ref];
        $digits = self::RECEIPT_DOWNLOAD_BANKS[$id];
        if ($digits > 0) {
            $acct = str_replace([' ', '-'], '', (string) $accountNumber);
            if (!preg_match('/^\d+$/', $acct) || strlen($acct) < $digits) {
                throw new \InvalidArgumentException("{$id} needs the receiving account number (at least the last {$digits} digits).");
            }
            $params['account'] = $acct;
        }
        return $this->options->baseUrl . '/api/receipt?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986);
    }

    // ─── Internal HTTP layer ──────────────────────────────────────

    /**
     * @param array<string, string|null> $r
     * @return array<string, string>
     */
    private static function cleanReceipt(array $r): array
    {
        $out = ['bank' => (string) $r['bank']];
        foreach (['reference', 'accountNumber', 'phoneNumber', 'qrData'] as $k) {
            if (isset($r[$k]) && $r[$k] !== '') {
                $out[$k] = (string) $r[$k];
            }
        }
        return $out;
    }

    /** @return array<string, mixed> */
    private function requestOrThrow(string $path): array
    {
        $response = $this->request('GET', $path, null);
        $status   = $response['status'];
        if ($response['data'] === null || $status === null || $status >= 400) {
            $message = $response['error'] ?? (string) ($response['data']['error'] ?? "cheki API returned {$status} for GET {$path}");
            throw new ChekiException($message, $status, $response['retryAfter']);
        }
        return $response['data'];
    }

    /**
     * One request with at most one retry.
     *
     * @param array<string, mixed>|null $payload
     * @return array{data: ?array<string, mixed>, error: ?string, status: ?int, retryAfter: ?int}
     */
    private function request(string $method, string $path, ?array $payload): array
    {
        $url     = $this->options->baseUrl . $path;
        $headers = array_merge([
            'Accept: application/json',
            'User-Agent: ' . $this->options->userAgent,
        ], $this->options->headers);
        if ($this->options->apiKey !== null && $this->options->apiKey !== '') {
            $headers[] = 'Authorization: Bearer ' . $this->options->apiKey;
        }

        $body = null;
        if ($payload !== null) {
            $body = json_encode($payload, JSON_UNESCAPED_SLASHES);
            if ($body === false) {
                return ['data' => null, 'error' => 'Failed to encode JSON payload: ' . json_last_error_msg(), 'status' => null, 'retryAfter' => null];
            }
            $headers[] = 'Content-Type: application/json';
        }

        $maxRetries = max(0, min(VerifyOptions::MAX_RETRIES, $this->options->maxRetries));
        for ($attempt = 0; ; $attempt++) {
            $canRetry = $attempt < $maxRetries;
            try {
                $resp = ($this->transport)($method, $url, $headers, $body, $this->options);
            } catch (TransportException $e) {
                if ($canRetry && !$e->timedOut) {
                    usleep(random_int(1000, 2000) * 1000);
                    continue;
                }
                return ['data' => null, 'error' => $e->getMessage(), 'status' => null, 'retryAfter' => null];
            }

            $status     = (int) $resp['status'];
            $retryAfter = self::parseRetryAfter($resp['headers']['retry-after'] ?? null);

            if (($status === 429 || $status >= 500) && $canRetry && ($retryAfter === null || $retryAfter <= self::MAX_RETRY_AFTER)) {
                usleep(($retryAfter !== null ? $retryAfter * 1000 : random_int(1000, 2000)) * 1000);
                continue;
            }

            $decoded = json_decode($resp['body'], true);
            if (!is_array($decoded)) {
                return ['data' => null, 'error' => "Invalid JSON response (HTTP {$status})", 'status' => $status, 'retryAfter' => $retryAfter];
            }
            return ['data' => $decoded, 'error' => null, 'status' => $status, 'retryAfter' => $retryAfter];
        }
    }

    /** Seconds from a Retry-After header (delta-seconds or HTTP-date), or null. */
    public static function parseRetryAfter(?string $value, ?int $now = null): ?int
    {
        if ($value === null || trim($value) === '') {
            return null;
        }
        $value = trim($value);
        if (ctype_digit($value)) {
            return (int) $value;
        }
        $ts = strtotime($value);
        if ($ts === false) {
            return null;
        }
        return max(0, $ts - ($now ?? time()));
    }

    /**
     * Default transport: cURL, one handle per attempt, no redirects.
     *
     * @param string[] $headers
     * @return array{status: int, headers: array<string, string>, body: string}
     */
    public static function curlTransport(string $method, string $url, array $headers, ?string $body, VerifyOptions $o): array
    {
        $ch = curl_init($url);
        if ($ch === false) {
            throw new TransportException('Failed to initialize cURL');
        }
        $responseHeaders = [];
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER         => false,
            CURLOPT_TIMEOUT        => $o->timeout,
            CURLOPT_CONNECTTIMEOUT => $o->connectTimeout,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_HEADERFUNCTION => static function ($ch, string $line) use (&$responseHeaders): int {
                $parts = explode(':', $line, 2);
                if (count($parts) === 2) {
                    $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                }
                return strlen($line);
            },
        ];
        if ($method === 'POST') {
            $opts[CURLOPT_POST]       = true;
            $opts[CURLOPT_POSTFIELDS] = $body ?? '';
        }
        curl_setopt_array($ch, $opts);
        $result = curl_exec($ch);
        if ($result === false) {
            $errno = curl_errno($ch);
            $error = curl_error($ch);
            curl_close($ch);
            throw new TransportException("cURL error ({$errno}): {$error}", $errno === CURLE_OPERATION_TIMEDOUT);
        }
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ['status' => $status, 'headers' => $responseHeaders, 'body' => (string) $result];
    }
}
