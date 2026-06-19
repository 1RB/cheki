<?php

/**
 * cheki PHP SDK - Basic usage example.
 *
 * Run: php examples/basic.php
 * (Make sure ext-curl and ext-json are enabled in your PHP installation.)
 */

require_once __DIR__ . '/../src/ChekiClient.php';
require_once __DIR__ . '/../src/VerifyResult.php';
require_once __DIR__ . '/../src/VerifyOptions.php';
require_once __DIR__ . '/../src/Bank.php';
require_once __DIR__ . '/../src/BatchResult.php';
require_once __DIR__ . '/../src/HealthStatus.php';

use Cheki\ChekiClient;
use Cheki\VerifyOptions;

echo "═══════════════════════════════════════════\n";
echo "  cheki PHP SDK - Basic Example\n";
echo "═══════════════════════════════════════════\n\n";

// --- 1. Create a client (default base URL: https://cheki-pi.vercel.app)
$client = new ChekiClient();

// Or with custom options:
// $client = new ChekiClient(
//     (new VerifyOptions())
//         ->withBaseUrl('https://cheki-pi.vercel.app')
//         ->withTimeout(15)
// );

// --- 2. Health check
echo "→ Health check...\n";
$health = $client->getHealth();
echo "  Status:   " . ($health->status ?? 'unknown') . "\n";
echo "  Version:  " . ($health->version ?? 'unknown') . "\n";
echo "  Healthy:  " . ($health->isHealthy() ? 'yes' : 'no') . "\n\n";

// --- 3. List supported banks
echo "→ Supported banks...\n";
$banks = $client->getBanks();
foreach ($banks as $bank) {
    $flag = $bank->requiresAccount ? ' [requires account]' : '';
    echo "  • {$bank->code} - {$bank->name}{$flag}\n";
}
echo "  Total: " . count($banks) . " banks\n\n";

// --- 4. Verify a single receipt
echo "→ Verifying a single receipt...\n";
$result = $client->verify(
    bank:          'cbe',
    reference:     'RB1234567890',
    accountNumber: '1000123456789'
);

if ($result->isVerified()) {
    echo "  ✅ Verified!\n";
    echo "  Bank:          {$result->bank}\n";
    echo "  Reference:     {$result->reference}\n";
    echo "  Sender:        {$result->senderName}\n";
    echo "  Receiver:      {$result->receiverName}\n";
    echo "  Amount:        {$result->amount} {$result->currency}\n";
    echo "  Date:          {$result->date}\n";
    echo "  Source URL:    {$result->sourceUrl}\n";
} else {
    echo "  ❌ Not verified";
    if ($result->error) {
        echo " - {$result->error}";
    }
    echo "\n";
}
echo "\n";

// --- 5. Verify a batch of receipts
echo "→ Batch verification...\n";
$batch = $client->verifyBatch([
    ['bank' => 'cbe',    'reference' => 'RB1234567890', 'accountNumber' => '1000123456789'],
    ['bank' => 'dashen', 'reference' => 'TR9876543210'],
    ['bank' => 'awash',  'reference' => 'AW5555555555', 'phoneNumber'   => '0911234567'],
]);

echo "  Total:    {$batch->total}\n";
echo "  Verified: {$batch->verified}\n";
echo "  Failed:   {$batch->failed}\n";

foreach ($batch->results as $i => $r) {
    $status = $r->isVerified() ? '✅' : '❌';
    $ref    = $r->reference ?? 'unknown';
    $err    = $r->error ? " ({$r->error})" : '';
    echo "    [{$i}] {$status} {$r->bank} / {$ref}{$err}\n";
}

echo "\n═══════════════════════════════════════════\n";
echo "  Done.\n";
echo "═══════════════════════════════════════════\n";
