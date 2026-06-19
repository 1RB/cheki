import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'models.dart';
import 'verify_options.dart';

/// A client for the cheki receipt verification API.
///
/// cheki is a free Ethiopian receipt verification service. This client
/// provides typed access to the four REST endpoints:
///
/// * [verify] — `POST /api/verify`
/// * [verifyBatch] — `POST /api/verify/batch`
/// * [getBanks] — `GET /api/banks`
/// * [getHealth] — `GET /api/health`
///
/// ## Usage
///
/// ```dart
/// final client = ChekiClient();
/// final result = await client.verify(
///   bank: 'cbe',
///   reference: 'RT123456789',
///   accountNumber: '1000123456789',
/// );
/// print(result.verified);
/// client.close();
/// ```
///
/// You can override the base URL (e.g. for testing or self-hosting):
///
/// ```dart
/// final client = ChekiClient(baseUrl: 'http://localhost:3000');
/// ```
class ChekiClient {
  /// The base URL of the cheki API (no trailing slash).
  final String baseUrl;

  /// The underlying HTTP client used for requests.
  ///
  /// Exposed so callers can inject a mock client in tests.
  final http.Client httpClient;

  /// Default headers sent with every request.
  final Map<String, String> _defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'cheki-dart-sdk/0.1.0',
  };

  /// Creates a new [ChekiClient].
  ///
  /// [baseUrl] defaults to the production cheki service.
  /// Pass a custom [client] to inject a mock or configured HTTP client.
  ChekiClient({
    String? baseUrl,
    http.Client? client,
  })  : baseUrl = (baseUrl ?? 'https://cheki-pi.vercel.app').replaceAll(
            RegExp(r'/+$'),
            ''),
        httpClient = client ?? http.Client();

  /// Verifies a single bank transfer receipt.
  ///
  /// [bank] is the bank code (e.g. `cbe`, `dashen`).
  /// [reference] is the transaction reference number.
  /// Provide [accountNumber], [phoneNumber], or [qrData] as required
  /// by the specific bank.
  ///
  /// Alternatively, pass a [VerifyOptions] object via [options] for
  /// a more structured approach.
  ///
  /// Returns a [VerifyResult] containing the verification details.
  ///
  /// Throws [ChekiException] on API-level errors or [FormatException]
  /// if the response cannot be decoded.
  Future<VerifyResult> verify({
    required String bank,
    required String reference,
    String? accountNumber,
    String? phoneNumber,
    String? qrData,
    VerifyOptions? options,
  }) async {
    final Map<String, dynamic> body;

    if (options != null) {
      body = options.toJson();
    } else {
      body = {
        'bank': bank,
        'reference': reference,
        if (accountNumber != null) 'accountNumber': accountNumber,
        if (phoneNumber != null) 'phoneNumber': phoneNumber,
        if (qrData != null) 'qrData': qrData,
      };
    }

    final response = await _post('/api/verify', body);
    final json = _decodeJson(response);
    return VerifyResult.fromJson(json);
  }

  /// Verifies multiple receipts in a single batch request.
  ///
  /// [receipts] is a list of [BatchReceipt] objects, each containing
  /// the bank code, reference, and optional account/phone numbers.
  ///
  /// Returns a [BatchResult] with aggregate counts and per-receipt results.
  ///
  /// Throws [ChekiException] on API-level errors.
  Future<BatchResult> verifyBatch(List<BatchReceipt> receipts) async {
    final body = {
      'receipts': receipts.map((r) => r.toJson()).toList(),
    };

    final response = await _post('/api/verify/batch', body);
    final json = _decodeJson(response);
    return BatchResult.fromJson(json);
  }

  /// Retrieves the list of banks supported by cheki.
  ///
  /// Returns a list of [BankInfo] objects.
  ///
  /// Throws [ChekiException] on API-level errors.
  Future<List<BankInfo>> getBanks() async {
    final response = await _get('/api/banks');
    final json = _decodeJson(response);

    final banksRaw = json['banks'] as List?;
    if (banksRaw == null) {
      throw ChekiException(
        'Unexpected response from /api/banks: missing "banks" field',
        statusCode: response.statusCode,
      );
    }

    return banksRaw
        .map((e) => BankInfo.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Checks the health of the cheki service.
  ///
  /// Returns a [HealthStatus] with the service status, version, and
  /// individual check results.
  ///
  /// Throws [ChekiException] on API-level errors.
  Future<HealthStatus> getHealth() async {
    final response = await _get('/api/health');
    final json = _decodeJson(response);
    return HealthStatus.fromJson(json);
  }

  /// Closes the underlying HTTP client and releases resources.
  ///
  /// Call this when you are done with the client, or use the client
  /// within a try/finally block:
  ///
  /// ```dart
  /// final client = ChekiClient();
  /// try {
  ///   // use client...
  /// } finally {
  ///   client.close();
  /// }
  /// ```
  void close() {
    httpClient.close();
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  Future<http.Response> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final uri = Uri.parse('$baseUrl$path');
    try {
      final response = await httpClient.post(
        uri,
        headers: _defaultHeaders,
        body: jsonEncode(body),
      );
      _checkStatus(response);
      return response;
    } on http.ClientException catch (e) {
      throw ChekiException(
        'HTTP request failed: ${e.message}',
        path: path,
      );
    } on SocketException catch (e) {
      throw ChekiException(
        'Network error: ${e.message}',
        path: path,
      );
    }
  }

  Future<http.Response> _get(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    try {
      final response = await httpClient.get(uri, headers: _defaultHeaders);
      _checkStatus(response);
      return response;
    } on http.ClientException catch (e) {
      throw ChekiException(
        'HTTP request failed: ${e.message}',
        path: path,
      );
    } on SocketException catch (e) {
      throw ChekiException(
        'Network error: ${e.message}',
        path: path,
      );
    }
  }

  void _checkStatus(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      String? apiError;
      try {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        apiError = json['error'] as String?;
      } catch (_) {
        // Response body is not JSON; use raw body.
        apiError = response.body.isNotEmpty ? response.body : null;
      }
      throw ChekiException(
        apiError ?? 'HTTP ${response.statusCode}',
        statusCode: response.statusCode,
      );
    }
  }

  Map<String, dynamic> _decodeJson(http.Response response) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) {
        throw ChekiException(
          'Unexpected response format: expected a JSON object',
          statusCode: response.statusCode,
        );
      }
      return decoded;
    } on FormatException catch (e) {
      throw ChekiException(
        'Failed to decode JSON response: ${e.message}',
        statusCode: response.statusCode,
      );
    }
  }
}

/// An exception thrown by the cheki client when an API request fails.
class ChekiException implements Exception {
  /// A human-readable error message.
  final String message;

  /// The HTTP status code associated with the error, if applicable.
  final int? statusCode;

  /// The API path that was called, if applicable.
  final String? path;

  /// Constructs a [ChekiException].
  const ChekiException(
    this.message, {
    this.statusCode,
    this.path,
  });

  @override
  String toString() {
    final parts = <String>[message];
    if (statusCode != null) parts.add('status: $statusCode');
    if (path != null) parts.add('path: $path');
    return 'ChekiException(${parts.join(', ')})';
  }
}
