<?php

declare(strict_types=1);

namespace Cheki;

/**
 * Client for the cheki receipt verification API.
 *
 *   $client = new ChekiClient();
 *   $result = $client->verify('cbe', 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01');
 *   if ($result->isVerified()) {
 *       echo $result->senderName . ' sent ' . $result->amount . ' ' . $result->currency;
 *   }
 *
 * isVerified() is the only success signal. verify() and verifyBatch() never
 * throw for API answers; getBanks() and getHealth() throw ChekiException.
 *
 * Retries (at most one, the same in every cheki SDK):
 * - GET (getBanks, getHealth): network errors and 5xx.
 * - POST /api/verify: network errors, and 429/503 with a Retry-After of at
 *   most 60 s. Never 500/502/504: the server already ran the check (a
 *   geo-blocked bank answers 502 every time).
 * - POST /api/verify/batch: only 429/503 with a short Retry-After. A 504
 *   means the batch ran out of time; replaying it would hit every bank again
 *   and charge every receipt against the rate limit.
 * - Never: timeouts, other 4xx, and any answer with "retryable": false or a
 *   fallbackUrl.
 */
class ChekiClient
{
    /** Maximum receipts per batch, enforced client-side. */
    public const MAX_BATCH_SIZE = 20;

    /**
     * Recommended chunk size for long lists. A batch is never retried, so
     * smaller chunks lose less work to a 504, and 15 leaves room in the
     * per-IP verify budget (30 per minute) for single checks.
     */
    public const RECOMMENDED_BATCH_CHUNK = 15;

    /** Banks GET /api/receipt serves, with the account digits their legacy format needs (0 when none). */
    public const RECEIPT_DOWNLOAD_BANKS = ['cbe' => 8, 'zemen' => 0, 'dashen' => 0, 'zamzam' => 0];

    /** Stricter reference rules the server applies per bank: a ZamZam receipt id is digits only. */
    public const RECEIPT_REFERENCE_RULES = [
        'zamzam' => ['/^[0-9]+$/', 'A ZamZam receipt id is digits only (the number at the end of the receipt link).'],
    ];

    private const BATCH_PATH = '/api/verify/batch';

    /** An older CBE FT reference (legacy format, needs the account). A Receipt ID does not. */
    public const LEGACY_CBE_REFERENCE = '/^FT[A-Za-z0-9]{8,12}$/i';

    /**
     * The shape of an uppercase-only reference per receipt-download bank (an
     * older CBE FT reference, a Dashen FT Ref, a ZamZam id). A reference that
     * only differs from it by case, spaces or dashes is sent in that shape, as
     * the server reads it. A CBE Receipt ID is case-sensitive and never changed.
     */
    private const RECEIPT_REFERENCE_SHAPES = [
        'cbe' => '/^FT[A-Z0-9]{8,12}$/',
        'dashen' => '/^[A-Z0-9]{16}$/',
        'zamzam' => '/^[0-9]+$/',
    ];

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
     * @param string|null $accountNumber BOA: last 5 digits of the account on the receipt (a full slip link can carry them). Older CBE FT receipts: the receiving account.
     * @param string|null $phoneNumber   Payer phone (CBE Birr).
     * @param string|null $qrData        Raw QR payload (a BOA QR code, the Payment QR Code on a Telebirr receipt, or the QR on a CBE Birr receipt, which carries the receipt number and payer phone).
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
     * verify limit (30 per minute). A batch is never replayed on a 5xx or
     * network error; split long lists into chunks of RECOMMENDED_BATCH_CHUNK
     * or fewer.
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

        $response = $this->request('POST', self::BATCH_PATH, ['receipts' => $clean]);
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
     * URL of GET /api/receipt, which opens the bank's own copy of a receipt.
     * Supported: CBE, Dashen, Zemen and ZamZam. Lead with the current format:
     * a CBE Receipt ID (from the mbreciept.cbe.com.et link), a Dashen FT Ref
     * or a ZamZam receipt id (digits only), which the server answers with a redirect to the
     * bank's own page. An
     * older CBE FT reference (legacy) also needs the receiving account (at
     * least its last 8 digits) and comes back as the bank's PDF. No request
     * is made.
     *
     * @throws \InvalidArgumentException For an unsupported bank, a bad reference, or a legacy CBE FT reference without the account.
     */
    public function getReceiptUrl(string $bank, string $reference, ?string $accountNumber = null): string
    {
        $id = strtolower(trim($bank));
        if (!array_key_exists($id, self::RECEIPT_DOWNLOAD_BANKS)) {
            throw new \InvalidArgumentException('Receipt download is only supported for: cbe, zemen, dashen, zamzam.');
        }
        $ref = self::canonicalReceiptReference($id, trim($reference));
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/', $ref) || str_contains($ref, '..')) {
            throw new \InvalidArgumentException('reference must be 1-64 letters, digits, dots, dashes or underscores.');
        }
        if (isset(self::RECEIPT_REFERENCE_RULES[$id]) && preg_match(self::RECEIPT_REFERENCE_RULES[$id][0], $ref) !== 1) {
            throw new \InvalidArgumentException(self::RECEIPT_REFERENCE_RULES[$id][1]);
        }
        $params = ['bank' => $id, 'reference' => $ref];
        $digits = self::RECEIPT_DOWNLOAD_BANKS[$id];
        // Only the legacy format needs the account: an older CBE FT reference.
        if ($digits > 0 && ($id !== 'cbe' || preg_match(self::LEGACY_CBE_REFERENCE, $ref) === 1)) {
            $acct = str_replace([' ', '-'], '', (string) $accountNumber);
            if (!preg_match('/^\d+$/', $acct) || strlen($acct) < $digits) {
                throw new \InvalidArgumentException("An older {$id} FT reference needs the receiving account number (at least the last {$digits} digits). A Receipt ID from the receipt link needs none.");
            }
            $params['account'] = $acct;
        }
        return $this->options->baseUrl . '/api/receipt?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986);
    }

    private static function canonicalReceiptReference(string $bank, string $reference): string
    {
        if (!isset(self::RECEIPT_REFERENCE_SHAPES[$bank])) {
            return $reference;
        }
        $compact = preg_replace('/[\s\-\x{2010}-\x{2015}\x{2212}]/u', '', $reference);
        if (!is_string($compact)) {
            return $reference; // not valid UTF-8: left for the validator to reject
        }
        $compact = strtoupper($compact);
        return preg_match(self::RECEIPT_REFERENCE_SHAPES[$bank], $compact) === 1 ? $compact : $reference;
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
     * One request with at most one retry, only where it is safe (see the
     * class docs and shouldRetry()).
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
                // A batch may have reached the server before the connection
                // broke; replaying it would run (and charge) every receipt again.
                if ($canRetry && !$e->timedOut && $path !== self::BATCH_PATH) {
                    usleep(random_int(1000, 2000) * 1000);
                    continue;
                }
                return ['data' => null, 'error' => $e->getMessage(), 'status' => null, 'retryAfter' => null];
            }

            $status     = (int) $resp['status'];
            $retryAfter = self::parseRetryAfter($resp['headers']['retry-after'] ?? null);

            $decoded = json_decode($resp['body'], true);

            if ($canRetry && self::shouldRetry($method, $status, $retryAfter, is_array($decoded) ? $decoded : null)) {
                usleep(($retryAfter !== null ? $retryAfter * 1000 : random_int(1000, 2000)) * 1000);
                continue;
            }

            if (!is_array($decoded)) {
                return ['data' => null, 'error' => "Invalid JSON response (HTTP {$status})", 'status' => $status, 'retryAfter' => $retryAfter];
            }
            return ['data' => $decoded, 'error' => null, 'status' => $status, 'retryAfter' => $retryAfter];
        }
    }

    /**
     * The retry rule shared by every cheki SDK (retryCases in
     * sdks/fixtures/api-contract.json): never when the body says
     * "retryable": false or carries a fallbackUrl; 429 and 503 only with a
     * Retry-After of at most 60 s; any other 5xx only for GET.
     *
     * @param array<string, mixed>|null $body
     */
    public static function shouldRetry(string $method, int $status, ?int $retryAfter, ?array $body): bool
    {
        if ($status !== 429 && $status < 500) {
            return false;
        }
        if ($body !== null && (($body['retryable'] ?? null) === false || is_string($body['fallbackUrl'] ?? null))) {
            return false;
        }
        if ($status === 429 || $status === 503) {
            return $retryAfter !== null && $retryAfter <= self::MAX_RETRY_AFTER;
        }
        return $method === 'GET' && ($retryAfter === null || $retryAfter <= self::MAX_RETRY_AFTER);
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
            // HTTP(S) only, whatever the base URL says.
            CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
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
            // No curl_close(): a no-op since PHP 8.0 and deprecated in 8.5;
            // the handle is freed when it goes out of scope.
            throw new TransportException("cURL error ({$errno}): {$error}", $errno === CURLE_OPERATION_TIMEDOUT);
        }
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        return ['status' => $status, 'headers' => $responseHeaders, 'body' => (string) $result];
    }
}
