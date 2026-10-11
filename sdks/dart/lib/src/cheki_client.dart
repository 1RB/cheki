import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' show parseHttpDate;

import 'models.dart';
import 'verify_options.dart';

/// SDK version, sent in the User-Agent header.
const String chekiSdkVersion = '1.4.1';

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
/// Retries: at most one, on network errors, 5xx and 429 (waiting out a
/// Retry-After of up to 60 s). Other 4xx and timeouts are never retried.
///
/// ```dart
/// final client = ChekiClient();
/// final result = await client.verify(
///   bank: 'cbe',
///   reference: 'FT26140P01YB',
///   accountNumber: '1000560536171',
/// );
/// print(result.isVerified);
/// client.close();
/// ```
class ChekiClient {
  /// Maximum receipts per batch, enforced client-side.
  static const int maxBatchSize = 20;

  /// Default per-attempt timeout. The server gives a verification up to
  /// 60 s, so the client waits a little longer.
  static const Duration defaultTimeout = Duration(seconds: 65);

  /// Most retries on top of the first attempt. The server already makes up to
  /// 2 attempts per bank fetch, so one SDK call reaches a bank at most 4 times.
  static const int maxRetriesCap = 1;

  /// Banks `/api/receipt` can download => account digits needed (0 = none).
  static const Map<String, int> receiptDownloadBanks = {'cbe': 8, 'zemen': 0, 'dashen': 0};

  static const Duration _maxRetryAfter = Duration(seconds: 60);
  static final RegExp _safeReference = RegExp(r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$');

  /// The base URL of the cheki API (no trailing slash).
  final String baseUrl;

  /// The underlying HTTP client (inject a `MockClient` in tests).
  final http.Client httpClient;

  /// Per-attempt timeout. `null` disables it.
  final Duration? timeout;

  /// Retries on network errors, 5xx and 429 (0 or 1).
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
  /// counts against the per-IP verify limit (30 per minute).
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
    final json = await _request('POST', '/api/verify/batch', {
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

  /// URL of `GET /api/receipt`, which downloads the bank's receipt file.
  /// Only CBE (needs the account number, at least its last 8 digits), Zemen
  /// and Dashen are supported. No request is made.
  ///
  /// Throws [ChekiValidationException] for an unsupported bank, a bad
  /// reference or a missing CBE account.
  String getReceiptUrl(String bank, String reference, [String? accountNumber]) {
    final id = bank.trim().toLowerCase();
    final digits = receiptDownloadBanks[id];
    if (digits == null) {
      throw const ChekiValidationException('Receipt download is only supported for: cbe, zemen, dashen.');
    }
    final ref = reference.trim();
    if (!_safeReference.hasMatch(ref) || ref.contains('..')) {
      throw const ChekiValidationException('reference must be 1-64 letters, digits, dots, dashes or underscores.');
    }
    final params = <String, String>{'bank': id, 'reference': ref};
    if (digits > 0) {
      final acct = (accountNumber ?? '').replaceAll(RegExp(r'[\s-]'), '');
      if (!RegExp(r'^\d+$').hasMatch(acct) || acct.length < digits) {
        throw ChekiValidationException('$id needs the receiving account number (at least the last $digits digits).');
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
        if (canRetry) {
          await Future<void>.delayed(_retryDelay(null));
          continue;
        }
        throw ChekiException('HTTP request failed: ${e.message}', path: path);
      }

      final status = response.statusCode;
      if (status >= 200 && status < 300) {
        try {
          final decoded = jsonDecode(response.body);
          if (decoded is Map<String, dynamic>) return decoded;
        } on FormatException {
          // fall through
        }
        throw ChekiException('Unexpected response: expected a JSON object', statusCode: status, path: path);
      }

      final retryAfter = parseRetryAfter(response.headers['retry-after']);
      final retryable = status == 429 || status >= 500;
      if (retryable && canRetry && (retryAfter == null || retryAfter <= _maxRetryAfter)) {
        await Future<void>.delayed(_retryDelay(retryAfter));
        continue;
      }
      throw ChekiException.fromResponse(response, path, retryAfter);
    }
  }

  Duration _retryDelay(Duration? retryAfter) => retryAfter ?? Duration(milliseconds: 1000 + _random.nextInt(1000));
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

  /// Constructs a [ChekiException].
  const ChekiException(this.message, {this.statusCode, this.path, this.fallbackUrl});

  /// Builds the right exception type for an error response.
  factory ChekiException.fromResponse(http.Response response, String path, Duration? retryAfter) {
    String? serverMessage;
    String? fallbackUrl;
    try {
      final json = jsonDecode(response.body);
      if (json is Map<String, dynamic>) {
        serverMessage = json['error'] is String ? json['error'] as String : null;
        fallbackUrl = json['fallbackUrl'] is String ? json['fallbackUrl'] as String : null;
      }
    } on FormatException {
      serverMessage = response.body.isNotEmpty ? response.body : null;
    }
    final status = response.statusCode;
    final message = serverMessage ?? 'HTTP $status';
    if (status == 429) {
      return ChekiRateLimitException(message, path: path, retryAfter: retryAfter);
    }
    if (status == 413) return ChekiPayloadTooLargeException(message, path: path);
    return ChekiException(message, statusCode: status, path: path, fallbackUrl: fallbackUrl);
  }

  @override
  String toString() {
    final parts = <String>[message];
    if (statusCode != null) parts.add('status: $statusCode');
    if (path != null) parts.add('path: $path');
    if (fallbackUrl != null) parts.add('fallbackUrl: $fallbackUrl');
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
