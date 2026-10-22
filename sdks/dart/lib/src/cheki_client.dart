import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' show parseHttpDate;

import 'models.dart';
import 'verify_options.dart';

/// SDK version, sent in the User-Agent header.
const String chekiSdkVersion = '1.6.0';

/// A client for the cheki receipt verification API.
///
/// * [verify] - `POST /api/verify`
/// * [verifyBatch] - `POST /api/verify/batch` (at most [maxBatchSize] receipts)
/// * [getBanks] - `GET /api/banks`
/// * [getHealth] - `GET /api/health`
///
/// [VerifyResult.isVerified] is the only success signal. A 200 response can
/// still be unverified (a decoded-only BOA QR code).
///
/// Retries (at most one, the same in every cheki SDK):
/// * `GET` ([getBanks], [getHealth]): network errors and 5xx.
/// * `POST /api/verify`: network errors, and 429/503 with a Retry-After of at
///   most 60 s. Never 500/502/504: the server already ran the check (a
///   geo-blocked bank answers 502 every time).
/// * `POST /api/verify/batch`: only 429/503 with a short Retry-After. A 504
///   means the batch ran out of time; replaying it would hit every bank again
///   and charge every receipt against the rate limit.
/// * Never: timeouts, other 4xx, and any answer with `"retryable": false` or
///   a `fallbackUrl`.
///
/// Responses are decoded as UTF-8 whatever the `content-type` charset says,
/// so Amharic names and messages arrive intact.
///
/// ```dart
/// final client = ChekiClient();
/// final result = await client.verify(
///   bank: 'cbe',
///   reference: 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01',
/// );
/// print(result.isVerified);
/// client.close();
/// ```
class ChekiClient {
  /// Maximum receipts per batch, enforced client-side.
  static const int maxBatchSize = 20;

  /// Recommended chunk size for long lists. A batch is never retried, so
  /// smaller chunks lose less work to a 504, and 15 leaves room in the per-IP
  /// verify budget (30 per minute) for single checks.
  static const int recommendedBatchChunk = 15;

  static const String _batchPath = '/api/verify/batch';

  /// Stricter reference rules the server applies per bank: a ZamZam receipt
  /// id is digits only.
  static final Map<String, (RegExp, String)> _receiptReferenceRules = {
    'zamzam': (
      RegExp(r'^[0-9]+$'),
      'A ZamZam receipt id is digits only (the number at the end of the receipt link).',
    ),
  };

  /// Default per-attempt timeout. The server gives a verification up to
  /// 60 s, so the client waits a little longer.
  static const Duration defaultTimeout = Duration(seconds: 65);

  /// Most retries on top of the first attempt. The server already makes up to
  /// 2 attempts per bank fetch, so one SDK call reaches a bank at most 4 times.
  static const int maxRetriesCap = 1;

  /// Banks `/api/receipt` serves => account digits their legacy format needs
  /// (0 = none). For CBE only an older FT reference needs the account; the
  /// current format (a Receipt ID from the mbreciept.cbe.com.et link) does not.
  static const Map<String, int> receiptDownloadBanks = {'cbe': 8, 'zemen': 0, 'dashen': 0, 'zamzam': 0};

  static final RegExp _legacyCbeReference = RegExp(r'^FT[A-Za-z0-9]{8,12}$', caseSensitive: false);

  /// The shape of an uppercase-only reference per receipt-download bank (an
  /// older CBE FT reference, a Dashen FT Ref, a ZamZam id). A reference that
  /// only differs from it by case, spaces or dashes is sent in that shape, as
  /// the server reads it. A CBE Receipt ID is case-sensitive and never changed.
  static final Map<String, RegExp> _receiptReferenceShapes = {
    'cbe': RegExp(r'^FT[A-Z0-9]{8,12}$'),
    'dashen': RegExp(r'^[A-Z0-9]{16}$'),
    'zamzam': RegExp(r'^[0-9]+$'),
  };

  static final RegExp _referenceSeparators = RegExp(r'[\s\-\u2010-\u2015\u2212]');

  static String _canonicalReceiptReference(String bank, String reference) {
    final shape = _receiptReferenceShapes[bank];
    if (shape == null) return reference;
    final compact = reference.replaceAll(_referenceSeparators, '').toUpperCase();
    return shape.hasMatch(compact) ? compact : reference;
  }

  static const Duration _maxRetryAfter = Duration(seconds: 60);
  static final RegExp _safeReference = RegExp(r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$');

  /// The base URL of the cheki API (no trailing slash).
  final String baseUrl;

  /// The underlying HTTP client (inject a `MockClient` in tests).
  final http.Client httpClient;

  /// Per-attempt timeout. `null` disables it.
  final Duration? timeout;

  /// Retries where a retry is safe (0 or 1; see the class docs).
  final int maxRetries;

  final String _userAgent;
  final Random _random = Random();

  /// Creates a new [ChekiClient].
  ///
  /// [timeout] defaults to [defaultTimeout] (65 s). [maxRetries] defaults to
  /// 1 and is clamped to 0..1.
  ChekiClient({
    String? baseUrl,
    http.Client? client,
    this.timeout = defaultTimeout,
    int maxRetries = maxRetriesCap,
    String? userAgent,
  })  : baseUrl = (baseUrl ?? 'https://cheki.et').replaceAll(RegExp(r'/+$'), ''),
        httpClient = client ?? http.Client(),
        maxRetries = maxRetries.clamp(0, maxRetriesCap),
        _userAgent = userAgent ?? 'cheki-dart-sdk/$chekiSdkVersion';

  /// Verifies a single receipt.
  ///
  /// Pass [bank] plus [reference] (or [qrData] alone for a BOA QR code), or a
  /// [VerifyOptions] object via [options].
  ///
  /// Returns for HTTP 200, which includes unverified decoded-only results:
  /// check [VerifyResult.isVerified]. Throws [ChekiException] for any other
  /// status ([ChekiRateLimitException] for 429,
  /// [ChekiPayloadTooLargeException] for 413).
  Future<VerifyResult> verify({
    String? bank,
    String? reference,
    String? accountNumber,
    String? phoneNumber,
    String? qrData,
    VerifyOptions? options,
  }) async {
    final opts = options ??
        VerifyOptions(
          bank: bank ?? '',
          reference: reference ?? '',
          accountNumber: accountNumber,
          phoneNumber: phoneNumber,
          qrData: qrData,
        );
    if (opts.bank.trim().isEmpty) {
      throw const ChekiValidationException('bank is required');
    }
    if (opts.reference.trim().isEmpty && (opts.qrData ?? '').trim().isEmpty) {
      throw const ChekiValidationException('reference or qrData is required');
    }
    final json = await _request('POST', '/api/verify', opts.toJson());
    return VerifyResult.fromJson(json);
  }

  /// Verifies up to [maxBatchSize] receipts in one request. Each item also
  /// counts against the per-IP verify limit (30 per minute). A batch is never
  /// replayed on a 5xx or network error; split long lists into chunks of
  /// [recommendedBatchChunk] or fewer.
  ///
  /// Throws [ChekiValidationException] for an empty batch or more than 20
  /// receipts, without making a request.
  Future<BatchResult> verifyBatch(List<BatchReceipt> receipts) async {
    if (receipts.isEmpty) {
      throw const ChekiValidationException('verifyBatch needs at least one receipt');
    }
    if (receipts.length > maxBatchSize) {
      throw ChekiValidationException(
        'verifyBatch accepts at most $maxBatchSize receipts (got ${receipts.length}). '
        'Split the list into chunks of $maxBatchSize.',
      );
    }
    final json = await _request('POST', _batchPath, {
      'receipts': receipts.map((r) => r.toJson()).toList(),
    });
    return BatchResult.fromJson(json);
  }

  /// Supported banks. [BankInfo.id] is the value to pass as `bank`.
  Future<List<BankInfo>> getBanks() async {
    final json = await _request('GET', '/api/banks', null);
    final raw = json['banks'];
    if (raw is! List) {
      throw const ChekiException('Unexpected response from /api/banks: missing "banks"', path: '/api/banks');
    }
    return raw.whereType<Map<String, dynamic>>().map(BankInfo.fromJson).toList();
  }

  /// Per-bank reachability (cached up to 5 minutes server-side).
  Future<HealthStatus> getHealth() async {
    return HealthStatus.fromJson(await _request('GET', '/api/health', null));
  }

  /// URL of `GET /api/receipt`, which opens the bank's own copy of a receipt.
  /// Supported: CBE, Dashen, Zemen and ZamZam. Lead with the current format: a
  /// CBE Receipt ID, a Dashen FT Ref or a ZamZam receipt id (digits only), which the server
  /// answers with a redirect to the bank's own receipt page. An older CBE FT reference (legacy) also
  /// needs the receiving account (at least its last 8 digits) and comes back
  /// as the bank's PDF. No request is made.
  ///
  /// Throws [ChekiValidationException] for an unsupported bank, a bad
  /// reference, or a legacy CBE FT reference without the account.
  String getReceiptUrl(String bank, String reference, [String? accountNumber]) {
    final id = bank.trim().toLowerCase();
    final digits = receiptDownloadBanks[id];
    if (digits == null) {
      throw const ChekiValidationException('Receipt download is only supported for: cbe, zemen, dashen, zamzam.');
    }
    final ref = _canonicalReceiptReference(id, reference.trim());
    if (!_safeReference.hasMatch(ref) || ref.contains('..')) {
      throw const ChekiValidationException('reference must be 1-64 letters, digits, dots, dashes or underscores.');
    }
    final rule = _receiptReferenceRules[id];
    if (rule != null && !rule.$1.hasMatch(ref)) {
      throw ChekiValidationException(rule.$2);
    }
    final params = <String, String>{'bank': id, 'reference': ref};
    if (digits > 0 && (id != 'cbe' || _legacyCbeReference.hasMatch(ref))) {
      final acct = (accountNumber ?? '').replaceAll(RegExp(r'[\s-]'), '');
      if (!RegExp(r'^\d+$').hasMatch(acct) || acct.length < digits) {
        throw ChekiValidationException(
            'An older $id FT reference needs the receiving account number (at least the last $digits digits). '
            'A Receipt ID from the receipt link needs none.');
      }
      params['account'] = acct;
    }
    return '$baseUrl/api/receipt?${Uri(queryParameters: params).query}';
  }

  /// Closes the underlying HTTP client.
  void close() => httpClient.close();

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  Future<Map<String, dynamic>> _request(String method, String path, Map<String, dynamic>? body) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{
      'Accept': 'application/json',
      'User-Agent': _userAgent,
      if (body != null) 'Content-Type': 'application/json',
    };

    for (var attempt = 0;; attempt++) {
      final canRetry = attempt < maxRetries;
      http.Response response;
      try {
        final future = method == 'POST'
            ? httpClient.post(uri, headers: headers, body: jsonEncode(body))
            : httpClient.get(uri, headers: headers);
        response = timeout != null ? await future.timeout(timeout!) : await future;
      } on TimeoutException {
        throw ChekiTimeoutException('Request to $path timed out after ${timeout!.inMilliseconds}ms', path: path);
      } on http.ClientException catch (e) {
        // A batch may have reached the server before the connection broke;
        // replaying it would run (and charge) every receipt again.
        if (canRetry && path != _batchPath) {
          await Future<void>.delayed(_retryDelay(null));
          continue;
        }
        throw ChekiException('HTTP request failed: ${e.message}', path: path);
      }

      final status = response.statusCode;
      final decoded = _decodeJson(response);
      if (status >= 200 && status < 300) {
        if (decoded is Map<String, dynamic>) return decoded;
        throw ChekiException('Unexpected response: expected a JSON object', statusCode: status, path: path);
      }

      final retryAfter = parseRetryAfter(response.headers['retry-after']);
      if (canRetry && _shouldRetry(method, status, retryAfter, decoded)) {
        await Future<void>.delayed(_retryDelay(retryAfter));
        continue;
      }
      throw ChekiException.fromResponse(response, path, retryAfter);
    }
  }

  /// The retry rule shared by every cheki SDK (`retryCases` in
  /// sdks/fixtures/api-contract.json): never when the body says
  /// `"retryable": false` or carries a `fallbackUrl`; 429 and 503 only with a
  /// Retry-After of at most 60 s; any other 5xx only for GET.
  static bool _shouldRetry(String method, int status, Duration? retryAfter, Object? body) {
    if (status != 429 && status < 500) return false;
    if (body is Map && (body['retryable'] == false || body['fallbackUrl'] is String)) return false;
    if (status == 429 || status == 503) return retryAfter != null && retryAfter <= _maxRetryAfter;
    return method == 'GET' && (retryAfter == null || retryAfter <= _maxRetryAfter);
  }

  Duration _retryDelay(Duration? retryAfter) => retryAfter ?? Duration(milliseconds: 1000 + _random.nextInt(1000));
}

/// The body as text, always decoded as UTF-8. `Response.body` uses the
/// `content-type` charset, and before http 1.4.0 it fell back to latin1 for
/// `application/json` without one, which garbled every non-ASCII character.
String _utf8Body(http.Response response) => utf8.decode(response.bodyBytes, allowMalformed: true);

/// The decoded JSON body, or null when it is not JSON.
Object? _decodeJson(http.Response response) {
  try {
    return jsonDecode(_utf8Body(response));
  } on FormatException {
    return null;
  }
}

/// Parses a Retry-After header (delta-seconds or HTTP-date).
Duration? parseRetryAfter(String? value, [DateTime? now]) {
  if (value == null || value.trim().isEmpty) return null;
  final v = value.trim();
  final secs = int.tryParse(v);
  if (secs != null && secs >= 0) return Duration(seconds: secs);
  try {
    final at = parseHttpDate(v);
    final d = at.difference(now ?? DateTime.now().toUtc());
    return d.isNegative ? Duration.zero : Duration(seconds: (d.inMilliseconds / 1000).round());
  } on FormatException {
    return null;
  }
}

/// Thrown when an API request fails.
///
/// Status codes: 400 bad input, 404 unsupported bank, 413 body too large,
/// 422 receipt not found or not a valid receipt, 429 rate limited, 502 bank
/// unreachable, 500 internal error.
class ChekiException implements Exception {
  /// A human-readable message (the server's text when it sent one).
  final String message;

  /// HTTP status, when there was a response.
  final int? statusCode;

  /// API path that was called.
  final String? path;

  /// For geo-blocked banks: open this link in a browser in Ethiopia instead.
  final String? fallbackUrl;

  /// On a 422: the bank page cheki asked, so you can see the bank's own answer.
  final String? checkedUrl;

  /// Constructs a [ChekiException].
  const ChekiException(this.message, {this.statusCode, this.path, this.fallbackUrl, this.checkedUrl});

  /// Builds the right exception type for an error response.
  factory ChekiException.fromResponse(http.Response response, String path, Duration? retryAfter) {
    String? serverMessage;
    String? fallbackUrl;
    String? checkedUrl;
    final json = _decodeJson(response);
    if (json is Map<String, dynamic>) {
      serverMessage = json['error'] is String ? json['error'] as String : null;
      fallbackUrl = json['fallbackUrl'] is String ? json['fallbackUrl'] as String : null;
      checkedUrl = json['checkedUrl'] is String ? json['checkedUrl'] as String : null;
    } else if (json == null) {
      final text = _utf8Body(response);
      serverMessage = text.isNotEmpty ? text : null;
    }
    final status = response.statusCode;
    final message = serverMessage ?? 'HTTP $status';
    if (status == 429) {
      return ChekiRateLimitException(message, path: path, retryAfter: retryAfter);
    }
    if (status == 413) return ChekiPayloadTooLargeException(message, path: path);
    return ChekiException(message, statusCode: status, path: path, fallbackUrl: fallbackUrl, checkedUrl: checkedUrl);
  }

  @override
  String toString() {
    final parts = <String>[message];
    if (statusCode != null) parts.add('status: $statusCode');
    if (path != null) parts.add('path: $path');
    if (fallbackUrl != null) parts.add('fallbackUrl: $fallbackUrl');
    if (checkedUrl != null) parts.add('checkedUrl: $checkedUrl');
    return '$runtimeType(${parts.join(', ')})';
  }
}

/// HTTP 429. [retryAfter] is the server's Retry-After, when sent.
class ChekiRateLimitException extends ChekiException {
  final Duration? retryAfter;

  const ChekiRateLimitException(super.message, {super.path, this.retryAfter}) : super(statusCode: 429);
}

/// HTTP 413: the request body is over the route's cap.
class ChekiPayloadTooLargeException extends ChekiException {
  const ChekiPayloadTooLargeException(super.message, {super.path}) : super(statusCode: 413);
}

/// An attempt timed out. Timeouts are not retried.
class ChekiTimeoutException extends ChekiException {
  const ChekiTimeoutException(super.message, {super.path});
}

/// Invalid input caught before any request was made.
class ChekiValidationException extends ChekiException {
  const ChekiValidationException(super.message);
}
