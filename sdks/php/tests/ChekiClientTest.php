<?php

declare(strict_types=1);

namespace Cheki\Tests;

use Cheki\ChekiClient;
use Cheki\ChekiException;
use Cheki\TransportException;
use Cheki\VerifyOptions;
use PHPUnit\Framework\TestCase;

/**
 * PHP SDK against the shared contract fixtures (sdks/fixtures/api-contract.json),
 * which tests/contract/sdk-fixtures.test.ts checks against the real route handlers.
 */
final class ChekiClientTest extends TestCase
{
    /** @var array<string, mixed> */
    private static array $contract;

    /** @var array<int, array{method: string, url: string, body: ?string, headers: string[]}> */
    private array $calls = [];

    public static function setUpBeforeClass(): void
    {
        self::$contract = json_decode((string) file_get_contents(__DIR__ . '/../../fixtures/api-contract.json'), true, 512, JSON_THROW_ON_ERROR);
    }

    /** @return array{status: int, headers: array<string, string>, body: string} */
    private static function fx(string $name, array $extraHeaders = []): array
    {
        $c = self::$contract['cases'][$name];
        $headers = [];
        foreach ($c['headers'] as $k => $v) {
            $headers[strtolower($k)] = $v;
        }
        foreach ($extraHeaders as $k => $v) {
            $headers[strtolower($k)] = $v;
        }
        return ['status' => $c['status'], 'headers' => $headers, 'body' => json_encode($c['body'])];
    }

    /** A client whose transport answers with the given responses in order (the last repeats). */
    private function client(array ...$answers): ChekiClient
    {
        $this->calls = [];
        $transport = function (string $method, string $url, array $headers, ?string $body) use ($answers): array {
            $this->calls[] = ['method' => $method, 'url' => $url, 'body' => $body, 'headers' => $headers];
            $a = $answers[min(count($this->calls) - 1, count($answers) - 1)];
            if (isset($a['throw'])) {
                throw $a['throw'];
            }
            return $a;
        };
        return new ChekiClient((new VerifyOptions())->withBaseUrl('https://api.test'), $transport);
    }

    public function testDefaults(): void
    {
        $limits = self::$contract['limits'];
        self::assertSame($limits['sdkTimeoutSeconds'], VerifyOptions::DEFAULT_TIMEOUT);
        self::assertGreaterThan($limits['serverMaxDurationSeconds'], VerifyOptions::DEFAULT_TIMEOUT);
        self::assertSame($limits['batchMaxReceipts'], ChekiClient::MAX_BATCH_SIZE);
        self::assertSame(1, VerifyOptions::MAX_RETRIES);
        self::assertSame(65, (new VerifyOptions())->timeout);
    }

    public function testVerifyVerified(): void
    {
        $r = $this->client(self::fx('verify_verified'))->verify('cbe', 'FT26140P01YB', '1000560536171');
        self::assertTrue($r->isVerified());
        self::assertSame(1250.5, $r->amount);
        self::assertFalse($r->cached);
        self::assertSame(200, $r->httpStatus);
        self::assertSame('https://api.test/api/verify', $this->calls[0]['url']);
        self::assertSame(['bank' => 'cbe', 'reference' => 'FT26140P01YB', 'accountNumber' => '1000560536171'], json_decode((string) $this->calls[0]['body'], true));
    }

    public function testDecodedOnlyIsNotVerified(): void
    {
        $r = $this->client(self::fx('verify_decoded_only'))->verify('boa', '', null, null, 'qr');
        self::assertTrue($r->success);
        self::assertTrue($r->decodedOnly);
        self::assertFalse($r->isVerified());
        self::assertSame(['bank' => 'boa', 'qrData' => 'qr'], json_decode((string) $this->calls[0]['body'], true));
    }

    public function testBatch(): void
    {
        $b = $this->client(self::fx('batch_mixed'))->verifyBatch([
            ['bank' => 'cbe', 'reference' => 'A1', 'accountNumber' => '1000560536171'],
            ['bank' => 'boa', 'qrData' => 'q'],
            ['bank' => 'telebirr', 'reference' => 'B2'],
        ]);
        self::assertSame([3, 1, 2, 0], [$b->total, $b->verified, $b->failed, $b->cached]);
        self::assertCount(1, $b->getVerified());
        self::assertTrue($b->results[1]->decodedOnly);
        self::assertSame(422, $b->results[2]->httpStatus);
        self::assertSame(2, $b->results[2]->index);
        self::assertNotNull($b->results[2]->error);
        $sent = json_decode((string) $this->calls[0]['body'], true);
        self::assertSame(['bank' => 'boa', 'qrData' => 'q'], $sent['receipts'][1], 'qrData is sent in batches');
    }

    public function testBatchOver20FailsWithoutRequest(): void
    {
        $client = $this->client(self::fx('batch_mixed'));
        $receipts = array_fill(0, 21, ['bank' => 'telebirr', 'reference' => 'R1']);
        try {
            $client->verifyBatch($receipts);
            self::fail('expected InvalidArgumentException');
        } catch (\InvalidArgumentException $e) {
            self::assertStringContainsString('20', $e->getMessage());
        }
        self::assertCount(0, $this->calls);
    }

    public function testBanks(): void
    {
        $banks = $this->client(self::fx('banks'))->getBanks();
        self::assertSame('cbe', $banks[0]->id);
        self::assertSame('cbe', $banks[0]->code);
        self::assertSame(8, $banks[0]->accountDigits);
        self::assertFalse($banks[0]->requiresPhone);
        // Formats come current first: CBE leads with the Receipt ID, the FT reference is legacy.
        self::assertFalse($banks[0]->requiresAccount);
        self::assertSame(['current', 'legacy'], array_map(static fn ($f) => $f->status, $banks[0]->formats));
        self::assertSame(['receiptId'], $banks[0]->formats[0]->inputs);
        self::assertSame(8, $banks[0]->formats[1]->accountDigits);
        self::assertTrue($banks[1]->isMobile());
        self::assertTrue($banks[2]->requiresPhone);
    }

    public function testBanksThrowsInsteadOfReturningEmpty(): void
    {
        $this->expectException(ChekiException::class);
        $this->client(self::fx('error_500_internal', ['retry-after' => '0']))->getBanks();
    }

    public function testHealth(): void
    {
        $h = $this->client(self::fx('health'))->getHealth();
        self::assertTrue($h->isHealthy());
        self::assertNotNull($h->checkedAt);
        self::assertFalse($h->cached);
        self::assertSame('geo-blocked', $h->banks[1]->status);
        self::assertSame(5004, $h->banks[1]->latencyMs);
    }

    /** @return array<string, array{string}> */
    public static function clientErrors(): array
    {
        return [
            '400' => ['error_400_missing_input'],
            '404' => ['error_404_unsupported_bank'],
            '413' => ['error_413_body_too_large'],
            '422' => ['error_422_not_found'],
        ];
    }

    /** @dataProvider clientErrors */
    public function testClientErrorsAreNotRetried(string $name): void
    {
        $r = $this->client(self::fx($name))->verify('cbe', 'X1');
        self::assertFalse($r->isVerified());
        self::assertSame(self::$contract['cases'][$name]['status'], $r->httpStatus);
        self::assertSame(self::$contract['cases'][$name]['body']['error'], $r->error);
        self::assertCount(1, $this->calls);
    }

    public function testPayloadTooLarge(): void
    {
        $r = $this->client(self::fx('error_413_body_too_large'))->verify('cbe', 'X1');
        self::assertTrue($r->isPayloadTooLarge());
    }

    public function testRateLimitRetriedOnceThenTyped(): void
    {
        $r = $this->client(self::fx('error_429_rate_limited', ['retry-after' => '0']))->verify('cbe', 'X1');
        self::assertTrue($r->isRateLimited());
        self::assertSame(0, $r->retryAfter);
        self::assertCount(2, $this->calls);

        $r = $this->client(self::fx('error_429_rate_limited', ['retry-after' => '0']), self::fx('verify_verified'))->verify('cbe', 'X1');
        self::assertTrue($r->isVerified());
        self::assertCount(2, $this->calls);
    }

    public function testLongRetryAfterIsNotWaited(): void
    {
        $r = $this->client(self::fx('error_429_rate_limited', ['retry-after' => '120']))->verify('cbe', 'X1');
        self::assertTrue($r->isRateLimited());
        self::assertSame(120, $r->retryAfter);
        self::assertCount(1, $this->calls);
    }

    public function testServerErrorRetriedOnceWithFallback(): void
    {
        $r = $this->client(self::fx('error_502_geo_blocked', ['retry-after' => '0']))->verify('telebirr', 'CHQ0FJ403O');
        self::assertSame(502, $r->httpStatus);
        self::assertStringStartsWith('https://transactioninfo', (string) $r->fallbackUrl);
        self::assertCount(2, $this->calls);
    }

    public function testTimeoutNotRetried(): void
    {
        $r = $this->client(['throw' => new TransportException('timed out', true)])->verify('cbe', 'X1');
        self::assertFalse($r->success);
        self::assertSame('timed out', $r->error);
        self::assertCount(1, $this->calls);
    }

    public function testNetworkErrorRetriedOnce(): void
    {
        $r = $this->client(['throw' => new TransportException('connection refused')])->verify('cbe', 'X1');
        self::assertFalse($r->success);
        self::assertCount(2, $this->calls);
    }

    public function testMaxRetriesClamped(): void
    {
        self::assertSame(1, (new VerifyOptions())->withMaxRetries(5)->maxRetries);
        self::assertSame(0, (new VerifyOptions())->withMaxRetries(-1)->maxRetries);
    }

    public function testReceiptUrl(): void
    {
        $c = $this->client(self::fx('health'));
        $cases = self::$contract['receiptUrlCases'];
        self::assertGreaterThan(5, count($cases));
        foreach ($cases as $case) {
            $acct = $case['account'] ?? null;
            if (!empty($case['error'])) {
                try {
                    $c->getReceiptUrl($case['bank'], $case['reference'], $acct);
                    self::fail("expected rejection for {$case['name']}");
                } catch (\InvalidArgumentException) {
                    self::addToAssertionCount(1);
                }
                continue;
            }
            $url = $c->getReceiptUrl($case['bank'], $case['reference'], $acct);
            $parts = parse_url($url);
            self::assertSame('https://api.test/api/receipt', $parts['scheme'] . '://' . $parts['host'] . $parts['path'], $case['name']);
            parse_str($parts['query'] ?? '', $query);
            ksort($query);
            $want = $case['query'];
            ksort($want);
            self::assertSame($want, $query, $case['name']);
        }
        // Current format first: a CBE Receipt ID needs no account.
        self::assertSame('https://api.test/api/receipt?bank=cbe&reference=fHCxExampleRcpt01', $c->getReceiptUrl('cbe', 'fHCxExampleRcpt01'));
    }

    public function testParseRetryAfter(): void
    {
        self::assertSame(17, ChekiClient::parseRetryAfter('17'));
        self::assertSame(5, ChekiClient::parseRetryAfter(gmdate('D, d M Y H:i:s', 1000005) . ' GMT', 1000000));
        self::assertNull(ChekiClient::parseRetryAfter('soon'));
        self::assertNull(ChekiClient::parseRetryAfter(null));
    }
}
