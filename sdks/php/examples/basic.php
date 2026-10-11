<?php

/**
 * cheki PHP SDK - basic usage.
 *
 * Run: php examples/basic.php   (needs ext-curl and ext-json)
 */

declare(strict_types=1);

require_once __DIR__ . '/../tests/bootstrap.php'; // or vendor/autoload.php when installed with Composer

use Cheki\ChekiClient;
use Cheki\ChekiException;

// Defaults: 65 s per attempt (the server may take up to 60 s), at most one retry.
$client = new ChekiClient();

// --- Health (cached up to 5 minutes server-side)
try {
    $health = $client->getHealth();
    echo "Health: {$health->status} (checked {$health->checkedAt})\n";
    foreach ($health->banks as $bank) {
        echo "  {$bank->id}: {$bank->status} ({$bank->latencyMs} ms)\n";
    }
} catch (ChekiException $e) {
    echo "Health check failed: {$e->getMessage()}\n";
}

// --- Supported banks ($bank->id is the value to pass to verify())
try {
    foreach ($client->getBanks() as $bank) {
        $flag = $bank->requiresAccount ? ' [requires account]' : '';
        echo "  {$bank->id} - {$bank->name} ({$bank->status}){$flag}\n";
    }
} catch (ChekiException $e) {
    echo "Could not list banks: {$e->getMessage()}\n";
}

// --- One receipt. Only isVerified() means the bank confirmed it.
// CBE: the receipt link or Receipt ID. Older FT-only receipts (legacy) also need
// the account: verify(bank: 'cbe', reference: 'FT26140P01YB', accountNumber: '1000560536171').
$result = $client->verify(bank: 'cbe', reference: 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01');

if ($result->isVerified()) {
    echo "VERIFIED: {$result->senderName} sent {$result->amount} {$result->currency} to {$result->receiverName}\n";
} elseif ($result->decodedOnly) {
    echo "NOT VERIFIED: decoded from a QR code, the bank could not confirm it\n";
} elseif ($result->isRateLimited()) {
    echo "Rate limited. Retry in " . ($result->retryAfter ?? 60) . " s\n";
} else {
    echo "NOT VERIFIED ({$result->httpStatus}): {$result->error}\n";
    if ($result->fallbackUrl !== null) {
        echo "Open the receipt directly: {$result->fallbackUrl}\n";
    }
}

// --- Up to 20 receipts per batch
$batch = $client->verifyBatch([
    ['bank' => 'cbe', 'reference' => 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01'],
    ['bank' => 'telebirr', 'reference' => 'CHQ0FJ403O'],
]);
echo "Batch: {$batch->verified}/{$batch->total} verified, {$batch->failed} not\n";
foreach ($batch->results as $r) {
    $state = $r->isVerified() ? 'verified' : ($r->decodedOnly ? 'decoded only' : 'not verified: ' . $r->error);
    echo "  [{$r->index}] {$state}\n";
}
