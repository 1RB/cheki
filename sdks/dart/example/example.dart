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
  final client = ChekiClient();

  try {
    // 1. Check service health
    print('=== Service Health ===');
    final health = await client.getHealth();
    print('Status: ${health.status}');
    print('Version: ${health.version}');
    print('');

    // 2. List supported banks
    print('=== Supported Banks ===');
    final banks = await client.getBanks();
    for (final bank in banks) {
      print('${bank.code.padRight(12)} ${bank.status.padRight(12)} ${bank.name}');
    }
    print('');

    // 3. Verify a single receipt
    print('=== Single Verification ===');
    final result = await client.verify(
      bank: 'cbe',
      reference: 'RT123456789',
      accountNumber: '1000123456789',
    );

    if (result.verified == true) {
      print('✓ Receipt verified!');
      print('  Sender:   ${result.senderName}');
      print('  Receiver: ${result.receiverName}');
      print('  Amount:   ${result.amount} ${result.currency}');
      print('  Date:     ${result.date}');
      print('  Source:   ${result.sourceUrl}');
    } else {
      print('✗ Verification failed: ${result.error}');
    }
    print('');

    // 4. Verify using VerifyOptions
    print('=== Verification via VerifyOptions ===');
    final optsResult = await client.verify(
      options: VerifyOptions(
        bank: 'dashen',
        reference: 'FT987654321',
        accountNumber: '5021345678',
      ),
    );
    print('Verified: ${optsResult.verified}');
    print('Error:    ${optsResult.error}');
    print('');

    // 5. Batch verification
    print('=== Batch Verification ===');
    final batchResult = await client.verifyBatch([
      BatchReceipt(
        bank: 'cbe',
        reference: 'RT111111111',
        accountNumber: '1000123456789',
      ),
      BatchReceipt(
        bank: 'dashen',
        reference: 'FT222222222',
        accountNumber: '5021345678',
      ),
      BatchReceipt(
        bank: 'awash',
        reference: 'TR333333333',
        phoneNumber: '0912345678',
      ),
    ]);

    print('Total:    ${batchResult.total}');
    print('Verified: ${batchResult.verified}');
    print('Failed:   ${batchResult.failed}');
    for (final r in batchResult.results) {
      print('  ${r.reference}: verified=${r.verified} error=${r.error}');
    }
  } on ChekiException catch (e) {
    print('cheki error: $e');
  } catch (e) {
    print('unexpected error: $e');
  } finally {
    client.close();
  }
}
