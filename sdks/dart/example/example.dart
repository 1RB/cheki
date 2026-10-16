// ignore_for_file: avoid_print

import 'package:cheki/cheki.dart';

/// Example usage of the cheki Dart SDK.
///
/// Run with:
///
/// ```sh
/// dart run example/example.dart
/// ```
void main() async {
  // Defaults: 65 s per attempt (the server may take up to 60 s), at most one retry.
  final client = ChekiClient();

  try {
    print('=== Service Health (cached up to 5 min) ===');
    final health = await client.getHealth();
    print('Status: ${health.status}, checked ${health.checkedAt}');
    for (final b in health.banks) {
      print('  ${b.id.padRight(10)} ${b.status.padRight(14)} ${b.latencyMs}ms');
    }

    print('\n=== Supported Banks (id is the value to pass as bank) ===');
    for (final bank in await client.getBanks()) {
      print('${bank.id.padRight(12)} ${bank.status.padRight(15)} ${bank.name}');
    }

    print('\n=== Single Verification ===');
    // CBE: the receipt link or Receipt ID. Older FT-only receipts (legacy) also
    // need the account: reference: 'FT26SAMPLE01', accountNumber: '1000000006171'.
    final result = await client.verify(bank: 'cbe', reference: 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01');
    if (result.isVerified) {
      print('VERIFIED: ${result.senderName} sent ${result.amount} ${result.currency} to ${result.receiverName}');
    } else if (result.decodedOnly) {
      print('NOT VERIFIED: decoded from a QR code, the bank could not confirm it');
    }

    print('\n=== Batch Verification (max ${ChekiClient.maxBatchSize}) ===');
    final batch = await client.verifyBatch(const [
      BatchReceipt(bank: 'cbe', reference: 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01'),
      BatchReceipt(bank: 'telebirr', reference: 'CHQ0SAMPLE'),
    ]);
    print('Verified ${batch.verified}/${batch.total}, failed ${batch.failed}');
    for (final r in batch.results) {
      print('  [${r.index}] ${r.isVerified ? 'verified' : 'not verified'} ${r.error ?? ''}');
    }
  } on ChekiRateLimitException catch (e) {
    print('Rate limited, retry in ${e.retryAfter?.inSeconds ?? 60}s');
  } on ChekiException catch (e) {
    // 422 not found, 404 unsupported bank, 502 bank unreachable (see e.fallbackUrl), ...
    print('Not verified: $e');
  } finally {
    client.close();
  }
}
