# cheki PHP SDK

A PHP SDK for [cheki](https://cheki-pi.vercel.app) — the free Ethiopian receipt verification service.

## Installation

### Via Composer

```bash
composer require cheki/cheki
```

### Manual

Clone or download this package and include the autoloader, or use Composer's autoloader:

```bash
git clone https://github.com/nicekwell/cheki.git
cd cheki/sdks/php
composer install  # optional — generates autoload, but not strictly required
```

If not using Composer, simply require the source files directly:

```php
require_once 'src/ChekiClient.php';
require_once 'src/VerifyResult.php';
require_once 'src/VerifyOptions.php';
require_once 'src/Bank.php';
require_once 'src/BatchResult.php';
require_once 'src/HealthStatus.php';
```

## Requirements

- PHP 8.0 or higher
- `ext-curl` (cURL extension)
- `ext-json` (JSON extension — included by default since PHP 8.0)

## Quick Start

```php
<?php

require_once 'vendor/autoload.php';

use Cheki\ChekiClient;

// Create a client — uses https://cheki-pi.vercel.app by default
$client = new ChekiClient();

// Verify a single receipt
$result = $client->verify(
    bank:          'cbe',
    reference:     'RB1234567890',
    accountNumber: '1000123456789'
);

if ($result->isVerified()) {
    echo "Verified: {$result->senderName} sent {$result->amount} {$result->currency}\n";
    echo "Date: {$result->date}\n";
    echo "Source: {$result->sourceUrl}\n";
} else {
    echo "Verification failed: {$result->error}\n";
}
```

## API Reference

### `ChekiClient`

The main client class for interacting with the cheki API.

#### Constructor

```php
$client = new ChekiClient(?VerifyOptions $options = null);
```

#### `verify()`

Verify a single receipt.

```php
public function verify(
    string $bank,
    string $reference,
    ?string $accountNumber = null,
    ?string $phoneNumber = null,
    ?string $qrData = null
): VerifyResult
```

| Parameter        | Type   | Required | Description                          |
|------------------|--------|----------|--------------------------------------|
| `bank`           | string | Yes      | Bank code (e.g. `'cbe'`, `'dashen'`) |
| `reference`      | string | Yes      | Receipt reference number             |
| `accountNumber`  | string | No       | Account number (required by some banks) |
| `phoneNumber`    | string | No       | Phone number (for mobile banking)    |
| `qrData`         | string | No       | Raw QR code data string              |

#### `verifyBatch()`

Verify multiple receipts in a single request.

```php
public function verifyBatch(array $receipts): BatchResult
```

```php
$batch = $client->verifyBatch([
    ['bank' => 'cbe',    'reference' => 'RB1234567890', 'accountNumber' => '1000123456789'],
    ['bank' => 'dashen', 'reference' => 'TR9876543210'],
    ['bank' => 'awash',  'reference' => 'AW5555555555', 'phoneNumber' => '0911234567'],
]);

echo "Verified: {$batch->verified} / {$batch->total}\n";

foreach ($batch->results as $result) {
    if ($result->isVerified()) {
        echo "✅ {$result->reference}: {$result->amount} {$result->currency}\n";
    } else {
        echo "❌ {$result->reference}: {$result->error}\n";
    }
}
```

#### `getBanks()`

List all supported banks.

```php
/** @return Bank[] */
public function getBanks(): array
```

```php
$banks = $client->getBanks();
foreach ($banks as $bank) {
    echo "{$bank->code} — {$bank->name}";
    if ($bank->requiresAccount) {
        echo " (requires account number)";
    }
    echo "\n";
}
```

#### `getHealth()`

Check API health status.

```php
public function getHealth(): HealthStatus
```

```php
$health = $client->getHealth();
if ($health->isHealthy()) {
    echo "API is up (v{$health->version})\n";
}
```

### `VerifyOptions`

Configure the client with custom options.

```php
use Cheki\VerifyOptions;

$options = (new VerifyOptions())
    ->withBaseUrl('https://cheki-pi.vercel.app')
    ->withTimeout(15)
    ->withApiKey('your-api-key')           // optional
    ->withHeaders(['X-Custom-Header' => 'value']);

$client = new ChekiClient($options);
```

| Option            | Type     | Default                        | Description                    |
|-------------------|----------|--------------------------------|--------------------------------|
| `baseUrl`         | string   | `https://cheki-pi.vercel.app`  | API base URL                   |
| `timeout`         | int      | `30`                           | Request timeout (seconds)      |
| `connectTimeout`  | int      | `10`                           | Connection timeout (seconds)   |
| `apiKey`          | ?string  | `null`                         | Bearer token for auth          |
| `headers`         | array    | `[]`                           | Extra HTTP headers             |
| `userAgent`       | string   | `cheki-php-sdk/1.0.0`          | User-Agent string              |

### `VerifyResult`

Returned by `verify()` and each item in `BatchResult::$results`.

| Property       | Type     | Description                        |
|----------------|----------|------------------------------------|
| `success`      | bool     | Whether the API call succeeded     |
| `verified`     | bool     | Whether the receipt was verified   |
| `bank`         | ?string  | Bank code                          |
| `reference`    | ?string  | Reference number                   |
| `senderName`   | ?string  | Sender's name                      |
| `receiverName` | ?string  | Receiver's name                    |
| `amount`       | ?string  | Transaction amount                 |
| `currency`     | ?string  | Currency code (e.g. ETB)           |
| `date`         | ?string  | Transaction date                   |
| `sourceUrl`    | ?string  | Source verification URL            |
| `error`        | ?string  | Error message if any               |
| `httpStatus`   | ?int     | HTTP status code                   |
| `raw`          | ?array   | Raw decoded response               |

Methods:
- `isVerified(): bool` — true if `success && verified`
- `getRaw(): ?array` — raw response data

### `BatchResult`

Returned by `verifyBatch()`.

| Property     | Type            | Description                  |
|--------------|-----------------|------------------------------|
| `success`    | bool            | Whether the API call succeeded |
| `total`      | int             | Total receipts submitted     |
| `verified`   | int             | Number verified              |
| `failed`     | int             | Number failed                |
| `results`    | VerifyResult[]  | Per-receipt results          |
| `error`      | ?string         | Error message if any         |
| `httpStatus` | ?int            | HTTP status code             |
| `raw`        | ?array          | Raw decoded response         |

Methods:
- `getVerified(): VerifyResult[]` — only verified results
- `getFailed(): VerifyResult[]` — only failed results

### `Bank`

Returned by `getBanks()`.

| Property          | Type    | Description                      |
|-------------------|---------|----------------------------------|
| `code`            | ?string | Bank code (e.g. `'cbe'`)         |
| `name`            | ?string | Bank name                        |
| `status`          | ?string | Bank status                      |
| `requiresAccount` | bool    | Whether account number required  |
| `raw`             | ?array  | Raw bank data                    |

Methods:
- `isActive(): bool` — whether bank is active/online

### `HealthStatus`

Returned by `getHealth()`.

| Property     | Type     | Description              |
|--------------|----------|--------------------------|
| `success`    | bool     | API call succeeded       |
| `status`     | ?string  | Health status string     |
| `version`    | ?string  | API version              |
| `timestamp`  | ?string  | Server timestamp         |
| `checks`     | ?array   | Individual health checks |
| `httpStatus` | ?int     | HTTP status code         |
| `raw`        | ?array   | Raw response             |

Methods:
- `isHealthy(): bool` — whether the service is healthy

## Error Handling

All methods return result objects rather than throwing exceptions. Check the `error` property or use convenience methods:

```php
$result = $client->verify('cbe', 'RB1234567890');

if ($result->error) {
    // Network error, invalid JSON, or API error
    echo "Error: {$result->error}\n";
    echo "HTTP Status: " . ($result->httpStatus ?? 'N/A') . "\n";
} elseif (!$result->isVerified()) {
    // Receipt could not be verified
    echo "Receipt not verified\n";
} else {
    // Success
    echo "Verified: {$result->amount} {$result->currency}\n";
}
```

## Examples

See [`examples/basic.php`](examples/basic.php) for a complete working example.

```bash
php examples/basic.php
```

## License

MIT
