// Dart SDK against the shared contract fixtures (sdks/fixtures/api-contract.json),
// which tests/contract/sdk-fixtures.test.ts checks against the real route handlers.
import 'dart:convert';
import 'dart:io';

import 'package:cheki/cheki.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';

late Map<String, dynamic> contract;

Map<String, dynamic> fx(String name) => contract['cases'][name] as Map<String, dynamic>;

http.Response respond(String name, [Map<String, String> extra = const {}]) {
  final c = fx(name);
  final headers = <String, String>{'content-type': 'application/json'};
  (c['headers'] as Map<String, dynamic>).forEach((k, v) => headers[k.toLowerCase()] = v as String);
  headers.addAll(extra);
  return http.Response(jsonEncode(c['body']), c['status'] as int, headers: headers);
}

/// A client whose transport answers in order (the last answer repeats).
(ChekiClient, List<http.Request>) clientFor(List<Object Function()> answers,
    {Duration? timeout = ChekiClient.defaultTimeout}) {
  final calls = <http.Request>[];
  final mock = MockClient((req) async {
    calls.add(req);
    final a = answers[(calls.length - 1).clamp(0, answers.length - 1)]();
    if (a is Exception) throw a;
    if (a is Future<http.Response>) return a;
    return a as http.Response;
  });
  return (ChekiClient(baseUrl: 'https://api.test', client: mock, timeout: timeout), calls);
}

void main() {
  setUpAll(() {
    contract = jsonDecode(File('../fixtures/api-contract.json').readAsStringSync()) as Map<String, dynamic>;
  });

  test('defaults match the contract limits', () {
    final limits = contract['limits'] as Map<String, dynamic>;
    expect(ChekiClient.defaultTimeout.inSeconds, limits['sdkTimeoutSeconds']);
    expect(ChekiClient.defaultTimeout.inSeconds, greaterThan(limits['serverMaxDurationSeconds'] as int));
    expect(ChekiClient.maxBatchSize, limits['batchMaxReceipts']);
    expect(ChekiClient(maxRetries: 5).maxRetries, 1);
  });

  group('models decode the fixtures', () {
    test('verified', () async {
      final (c, calls) = clientFor([() => respond('verify_verified')]);
      final r = await c.verify(bank: 'cbe', reference: 'FT26140P01YB', accountNumber: '1000560536171');
      expect(r.isVerified, isTrue);
      expect(r.amount, 1250.5);
      expect(r.cached, isFalse);
      expect(jsonDecode(calls.single.body),
          {'bank': 'cbe', 'reference': 'FT26140P01YB', 'accountNumber': '1000560536171'});
    });

    test('decodedOnly is success but not verified; QR-only sends no reference', () async {
      final (c, calls) = clientFor([() => respond('verify_decoded_only')]);
      final r = await c.verify(bank: 'boa', qrData: 'qr');
      expect(r.success, isTrue);
      expect(r.decodedOnly, isTrue);
      expect(r.isVerified, isFalse);
      expect(jsonDecode(calls.single.body), {'bank': 'boa', 'qrData': 'qr'});
    });

    test('parsed results are never verified', () {
      final r = VerifyResult.fromJson(fx('parse_client_supplied')['body'] as Map<String, dynamic>);
      expect(r.parsed, isTrue);
      expect(r.isVerified, isFalse);
    });

    test('batch', () async {
      final (c, _) = clientFor([() => respond('batch_mixed')]);
      final b = await c.verifyBatch(const [
        BatchReceipt(bank: 'cbe', reference: 'A1', accountNumber: '1000560536171'),
        BatchReceipt(bank: 'boa', qrData: 'q'),
        BatchReceipt(bank: 'telebirr', reference: 'B2'),
      ]);
      expect([b.total, b.verified, b.failed, b.cached], [3, 1, 2, 0]);
      expect(b.results.map((r) => r.index), [0, 1, 2]);
      expect(b.results[1].decodedOnly, isTrue);
      expect(b.results[2].success, isFalse);
      expect(b.results[2].status, 422);
    });

    test('orderId, beta and batch fallbackUrl', () async {
      var (c, _) = clientFor([() => respond('verify_order_id')]);
      expect((await c.verify(bank: 'cbebirr', reference: 'DTS41AB2C90', phoneNumber: '0911004321')).orderId,
          'FT26SAMPLE01');
      (c, _) = clientFor([() => respond('banks')]);
      final beta = {for (final b in await c.getBanks()) b.id: b.beta};
      expect([beta['zamzam'], beta['mpesa'], beta['cbe']], [true, true, false]);
      (c, _) = clientFor([
        () => http.Response(
            jsonEncode({
              'success': true,
              'results': [
                {'success': false, 'error': 'geo', 'status': 502, 'fallbackUrl': 'https://x.test/r'}
              ],
              'total': 1,
              'verified': 0,
              'failed': 1,
              'cached': 0,
            }),
            200)
      ]);
      final b = await c.verifyBatch(const [BatchReceipt(bank: 'telebirr', reference: 'A1')]);
      expect(b.results.single.fallbackUrl, 'https://x.test/r');
      expect(ChekiClient.recommendedBatchChunk, lessThanOrEqualTo(ChekiClient.maxBatchSize));
    });

    test('banks: id, deprecated code alias, requiresPhone default', () async {
      final (c, _) = clientFor([() => respond('banks')]);
      final banks = await c.getBanks();
      expect(banks.first.id, 'cbe');
      // ignore: deprecated_member_use_from_same_package
      expect(banks.first.code, 'cbe');
      expect(banks.first.requiresPhone, isFalse);
      expect(banks[1].isMobile, isTrue);
      expect(banks[2].requiresPhone, isTrue);
      // Formats come current first: CBE leads with the Receipt ID, the FT reference is legacy.
      expect(banks.first.requiresAccount, isFalse);
      expect(banks.first.formats.map((f) => f.status).toList(), ['current', 'legacy']);
      expect(banks.first.formats.first.inputs, ['receiptId']);
      expect(banks.first.formats[1].accountDigits, 8);
    });

    test('health', () async {
      final (c, calls) = clientFor([() => respond('health')]);
      final h = await c.getHealth();
      expect(h.isOk, isTrue);
      expect(h.checkedAt, isNotNull);
      expect(h.cached, isFalse);
      expect(h.banks[1].status, 'geo-blocked');
      expect(calls.single.headers.containsKey('Content-Type'), isFalse);
    });
  });

  group('errors and retries', () {
    for (final name in ['error_400_missing_input', 'error_404_unsupported_bank', 'error_422_not_found']) {
      test('$name is thrown once with the server message', () async {
        final (c, calls) = clientFor([() => respond(name)]);
        await expectLater(
          c.verify(bank: 'cbe', reference: 'X1'),
          throwsA(isA<ChekiException>()
              .having((e) => e.statusCode, 'status', fx(name)['status'])
              .having((e) => e.message, 'message', (fx(name)['body'] as Map)['error'])),
        );
        expect(calls, hasLength(1));
      });
    }

    test('413 is typed and not retried', () async {
      final (c, calls) = clientFor([() => respond('error_413_body_too_large')]);
      await expectLater(c.verify(bank: 'cbe', reference: 'X1'), throwsA(isA<ChekiPayloadTooLargeException>()));
      expect(calls, hasLength(1));
    });

    test('429 retried once, then ChekiRateLimitException', () async {
      final (c, calls) = clientFor([
        () => respond('error_429_rate_limited', {'retry-after': '0'})
      ]);
      await expectLater(
        c.verify(bank: 'cbe', reference: 'X1'),
        throwsA(isA<ChekiRateLimitException>().having((e) => e.retryAfter, 'retryAfter', Duration.zero)),
      );
      expect(calls, hasLength(2));
    });

    test('429 then success', () async {
      final (c, calls) = clientFor([
        () => respond('error_429_rate_limited', {'retry-after': '0'}),
        () => respond('verify_verified')
      ]);
      expect((await c.verify(bank: 'cbe', reference: 'X1')).isVerified, isTrue);
      expect(calls, hasLength(2));
    });

    test('long Retry-After is not waited', () async {
      final (c, calls) = clientFor([
        () => respond('error_429_rate_limited', {'retry-after': '120'})
      ]);
      await expectLater(
        c.verify(bank: 'cbe', reference: 'X1'),
        throwsA(isA<ChekiRateLimitException>().having((e) => e.retryAfter, 'retryAfter', const Duration(seconds: 120))),
      );
      expect(calls, hasLength(1));
    });

    test('502 geo-blocked is not retried, fallbackUrl kept', () async {
      final (c, calls) = clientFor([
        () => respond('error_502_geo_blocked', {'retry-after': '0'})
      ]);
      await expectLater(
        c.verify(bank: 'telebirr', reference: 'CHQ0FJ403O'),
        throwsA(
            isA<ChekiException>().having((e) => e.fallbackUrl, 'fallbackUrl', startsWith('https://transactioninfo'))),
      );
      expect(calls, hasLength(1));
    });

    group('shared retryCases fixture (the same rule in every SDK)', () {
      final raw = jsonDecode(File('../fixtures/api-contract.json').readAsStringSync()) as Map<String, dynamic>;
      for (final rc in (raw['retryCases'] as List).cast<Map<String, dynamic>>()) {
        test('${rc['name']}: ${rc['retried'] == true ? 'retried once' : 'not retried'}', () async {
          final headers = <String, String>{'content-type': 'application/json'};
          (rc['headers'] as Map<String, dynamic>).forEach((k, v) => headers[k.toLowerCase()] = v as String);
          final body = rc.containsKey('rawBody') ? rc['rawBody'] as String : jsonEncode(rc['body']);
          final (c, calls) = clientFor([() => http.Response(body, rc['status'] as int, headers: headers)]);
          final Future<Object?> run = switch (rc['path']) {
            '/api/verify' => c.verify(bank: 'telebirr', reference: 'CHQ0FJ403O'),
            '/api/verify/batch' => c.verifyBatch(const [BatchReceipt(bank: 'telebirr', reference: 'CHQ0FJ403O')]),
            '/api/banks' => c.getBanks(),
            _ => c.getHealth(),
          };
          await expectLater(run, throwsA(isA<ChekiException>().having((e) => e.statusCode, 'status', rc['status'])));
          expect(calls.first.method, rc['method']);
          expect(calls, hasLength(rc['retried'] == true ? 2 : 1));
        });
      }
    });

    test('network errors retried once for GET and verify, never for a batch', () async {
      var (c, calls) = clientFor([() => http.ClientException('connection refused')]);
      await expectLater(c.getBanks(), throwsA(isA<ChekiException>()));
      expect(calls, hasLength(2));
      (c, calls) = clientFor([() => http.ClientException('connection refused')]);
      await expectLater(c.verify(bank: 'cbe', reference: 'X1'), throwsA(isA<ChekiException>()));
      expect(calls, hasLength(2));
      (c, calls) = clientFor([() => http.ClientException('connection reset')]);
      await expectLater(
          c.verifyBatch(const [BatchReceipt(bank: 'cbe', reference: 'X1')]), throwsA(isA<ChekiException>()));
      expect(calls, hasLength(1));
    });

    test('bodies are decoded as UTF-8 whatever the charset says', () async {
      final ok = utf8.encode(jsonEncode({
        'success': true,
        'verified': true,
        'senderName': 'አበበ ከበደ',
        'bank': 'Telebirr',
        'bankCode': 'telebirr',
        'reference': 'X1',
        'sourceUrl': 'https://x.test',
      }));
      var (c, _) = clientFor([
        () => http.Response.bytes(ok, 200, headers: {'content-type': 'text/plain'})
      ]);
      expect((await c.verify(bank: 'telebirr', reference: 'X1')).senderName, 'አበበ ከበደ');
      final err = utf8.encode(jsonEncode({'success': false, 'error': 'ደረሰኝ አልተገኘም'}));
      (c, _) = clientFor([
        () => http.Response.bytes(err, 422, headers: {'content-type': 'text/plain'})
      ]);
      await expectLater(c.verify(bank: 'telebirr', reference: 'X1'),
          throwsA(isA<ChekiException>().having((e) => e.message, 'message', 'ደረሰኝ አልተገኘም')));
    });

    test('timeouts are not retried', () async {
      final (c, calls) = clientFor(
        [() => Future<http.Response>.delayed(const Duration(seconds: 2), () => respond('health'))],
        timeout: const Duration(milliseconds: 50),
      );
      await expectLater(c.getHealth(), throwsA(isA<ChekiTimeoutException>()));
      expect(calls, hasLength(1));
    });

    test('batch over 20 fails without a request', () async {
      final (c, calls) = clientFor([() => respond('batch_mixed')]);
      final receipts = List.generate(21, (i) => BatchReceipt(bank: 'telebirr', reference: 'R$i'));
      await expectLater(c.verifyBatch(receipts), throwsA(isA<ChekiValidationException>()));
      await expectLater(c.verifyBatch(const []), throwsA(isA<ChekiValidationException>()));
      expect(calls, isEmpty);
    });
  });

  test('getReceiptUrl follows the shared receiptUrlCases fixture', () {
    final c = ChekiClient(baseUrl: 'https://api.test');
    final cases = (contract['receiptUrlCases'] as List).cast<Map<String, dynamic>>();
    expect(cases.length, greaterThan(5));
    for (final tc in cases) {
      final name = tc['name'] as String;
      final account = tc['account'] as String?;
      if (tc['error'] == true) {
        expect(() => c.getReceiptUrl(tc['bank'] as String, tc['reference'] as String, account),
            throwsA(isA<ChekiValidationException>()),
            reason: name);
        continue;
      }
      final u = Uri.parse(c.getReceiptUrl(tc['bank'] as String, tc['reference'] as String, account));
      expect('${u.scheme}://${u.host}${u.path}', 'https://api.test/api/receipt', reason: name);
      expect(u.queryParameters, Map<String, String>.from(tc['query'] as Map), reason: name);
    }
    // Current format first: a CBE Receipt ID needs no account.
    expect(c.getReceiptUrl('cbe', 'fHCxExampleRcpt01'),
        'https://api.test/api/receipt?bank=cbe&reference=fHCxExampleRcpt01');
  });

  test('parseRetryAfter', () {
    final now = DateTime.utc(2026, 10, 11, 9);
    expect(parseRetryAfter('17'), const Duration(seconds: 17));
    expect(parseRetryAfter(HttpDate.format(now.add(const Duration(seconds: 5))), now), const Duration(seconds: 5));
    expect(parseRetryAfter('soon'), isNull);
  });
}
