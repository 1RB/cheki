/// Data models returned by the cheki API.

/// The result of a single receipt verification request.
///
/// Mirrors the JSON object returned by `POST /api/verify`.
class VerifyResult {
  /// Whether the API request itself succeeded (HTTP-level success).
  final bool success;

  /// Whether the receipt was verified as legitimate.
  final bool? verified;

  /// The bank code associated with the receipt (e.g. `cbe`, `dashen`).
  final String? bank;

  /// The transaction reference number.
  final String? reference;

  /// The name of the sender on the verified receipt.
  final String? senderName;

  /// The name of the receiver on the verified receipt.
  final String? receiverName;

  /// The monetary amount of the transfer.
  final double? amount;

  /// The currency code (e.g. `ETB`).
  final String? currency;

  /// The date of the transaction (as reported by the bank).
  final String? date;

  /// The source URL from which the receipt was fetched/verified.
  final String? sourceUrl;

  /// An error message if verification failed or the request was unsuccessful.
  final String? error;

  /// Constructs a [VerifyResult] from its fields.
  const VerifyResult({
    required this.success,
    this.verified,
    this.bank,
    this.reference,
    this.senderName,
    this.receiverName,
    this.amount,
    this.currency,
    this.date,
    this.sourceUrl,
    this.error,
  });

  /// Creates a [VerifyResult] from a decoded JSON map.
  factory VerifyResult.fromJson(Map<String, dynamic> json) {
    return VerifyResult(
      success: json['success'] as bool? ?? false,
      verified: json['verified'] as bool?,
      bank: json['bank'] as String?,
      reference: json['reference'] as String?,
      senderName: json['senderName'] as String?,
      receiverName: json['receiverName'] as String?,
      amount: (json['amount'] as num?)?.toDouble(),
      currency: json['currency'] as String?,
      date: json['date'] as String?,
      sourceUrl: json['sourceUrl'] as String?,
      error: json['error'] as String?,
    );
  }

  /// Converts this result back to a JSON map.
  Map<String, dynamic> toJson() {
    return {
      'success': success,
      if (verified != null) 'verified': verified,
      if (bank != null) 'bank': bank,
      if (reference != null) 'reference': reference,
      if (senderName != null) 'senderName': senderName,
      if (receiverName != null) 'receiverName': receiverName,
      if (amount != null) 'amount': amount,
      if (currency != null) 'currency': currency,
      if (date != null) 'date': date,
      if (sourceUrl != null) 'sourceUrl': sourceUrl,
      if (error != null) 'error': error,
    };
  }

  @override
  String toString() {
    return 'VerifyResult(success: $success, verified: $verified, bank: $bank, '
        'reference: $reference, senderName: $senderName, receiverName: '
        '$receiverName, amount: $amount, currency: $currency, date: $date, '
        'sourceUrl: $sourceUrl, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is VerifyResult &&
        other.success == success &&
        other.verified == verified &&
        other.bank == bank &&
        other.reference == reference &&
        other.senderName == senderName &&
        other.receiverName == receiverName &&
        other.amount == amount &&
        other.currency == currency &&
        other.date == date &&
        other.sourceUrl == sourceUrl &&
        other.error == error;
  }

  @override
  int get hashCode => Object.hash(
        success,
        verified,
        bank,
        reference,
        senderName,
        receiverName,
        amount,
        currency,
        date,
        sourceUrl,
        error,
      );
}

/// Information about a single bank supported by cheki.
///
/// Mirrors an element of the `banks` array returned by `GET /api/banks`.
class BankInfo {
  /// The short bank code used in API requests (e.g. `cbe`, `dashen`).
  final String code;

  /// The human-readable name of the bank.
  final String name;

  /// The current operational status of the bank integration.
  ///
  /// Common values: `active`, `inactive`, `maintenance`.
  final String status;

  /// Whether the bank requires an account number for verification.
  final bool requiresAccount;

  /// Additional optional fields the bank may require or support.
  final bool? requiresPhone;

  /// Whether QR-based verification is supported for this bank.
  final bool? supportsQr;

  /// Constructs a [BankInfo] from its fields.
  const BankInfo({
    required this.code,
    required this.name,
    required this.status,
    required this.requiresAccount,
    this.requiresPhone,
    this.supportsQr,
  });

  /// Creates a [BankInfo] from a decoded JSON map.
  factory BankInfo.fromJson(Map<String, dynamic> json) {
    return BankInfo(
      code: json['code'] as String,
      name: json['name'] as String,
      status: json['status'] as String,
      requiresAccount: json['requiresAccount'] as bool? ?? false,
      requiresPhone: json['requiresPhone'] as bool?,
      supportsQr: json['supportsQr'] as bool?,
    );
  }

  /// Converts this [BankInfo] back to a JSON map.
  Map<String, dynamic> toJson() {
    return {
      'code': code,
      'name': name,
      'status': status,
      'requiresAccount': requiresAccount,
      if (requiresPhone != null) 'requiresPhone': requiresPhone,
      if (supportsQr != null) 'supportsQr': supportsQr,
    };
  }

  @override
  String toString() =>
      'BankInfo(code: $code, name: $name, status: $status, '
      'requiresAccount: $requiresAccount)';

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is BankInfo &&
        other.code == code &&
        other.name == name &&
        other.status == status &&
        other.requiresAccount == requiresAccount &&
        other.requiresPhone == requiresPhone &&
        other.supportsQr == supportsQr;
  }

  @override
  int get hashCode =>
      Object.hash(code, name, status, requiresAccount, requiresPhone, supportsQr);
}

/// The health status of the cheki service.
///
/// Mirrors the JSON returned by `GET /api/health`.
class HealthStatus {
  /// Whether the health check request succeeded.
  final bool success;

  /// The overall service status (e.g. `ok`, `degraded`, `down`).
  final String status;

  /// The API version string.
  final String? version;

  /// ISO timestamp of the health check.
  final String? timestamp;

  /// Individual health check entries.
  final List<HealthCheck> checks;

  /// Constructs a [HealthStatus] from its fields.
  const HealthStatus({
    required this.success,
    required this.status,
    this.version,
    this.timestamp,
    this.checks = const [],
  });

  /// Creates a [HealthStatus] from a decoded JSON map.
  factory HealthStatus.fromJson(Map<String, dynamic> json) {
    final checksRaw = json['checks'] as List?;
    return HealthStatus(
      success: json['success'] as bool? ?? false,
      status: json['status'] as String? ?? 'unknown',
      version: json['version'] as String?,
      timestamp: json['timestamp'] as String?,
      checks: checksRaw
              ?.map((e) => HealthCheck.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  /// Converts this [HealthStatus] back to a JSON map.
  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'status': status,
      if (version != null) 'version': version,
      if (timestamp != null) 'timestamp': timestamp,
      'checks': checks.map((e) => e.toJson()).toList(),
    };
  }

  @override
  String toString() =>
      'HealthStatus(success: $success, status: $status, version: $version, '
      'timestamp: $timestamp, checks: $checks)';
}

/// A single health check entry within a [HealthStatus] response.
class HealthCheck {
  /// The name of the check (e.g. `database`, `upstream`).
  final String name;

  /// Whether this individual check passed.
  final bool ok;

  /// An optional message describing the check result.
  final String? message;

  /// Constructs a [HealthCheck] from its fields.
  const HealthCheck({
    required this.name,
    required this.ok,
    this.message,
  });

  /// Creates a [HealthCheck] from a decoded JSON map.
  factory HealthCheck.fromJson(Map<String, dynamic> json) {
    return HealthCheck(
      name: json['name'] as String? ?? 'unknown',
      ok: json['ok'] as bool? ?? false,
      message: json['message'] as String?,
    );
  }

  /// Converts this [HealthCheck] back to a JSON map.
  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'ok': ok,
      if (message != null) 'message': message,
    };
  }

  @override
  String toString() => 'HealthCheck(name: $name, ok: $ok, message: $message)';
}

/// The result of a batch verification request.
///
/// Mirrors the JSON returned by `POST /api/verify/batch`.
class BatchResult {
  /// Whether the batch request itself succeeded.
  final bool success;

  /// Total number of receipts in the batch.
  final int total;

  /// Number of receipts that were verified.
  final int verified;

  /// Number of receipts that failed verification.
  final int failed;

  /// Per-receipt results, in the same order as the input.
  final List<VerifyResult> results;

  /// Constructs a [BatchResult] from its fields.
  const BatchResult({
    required this.success,
    required this.total,
    required this.verified,
    required this.failed,
    required this.results,
  });

  /// Creates a [BatchResult] from a decoded JSON map.
  factory BatchResult.fromJson(Map<String, dynamic> json) {
    final resultsRaw = json['results'] as List?;
    return BatchResult(
      success: json['success'] as bool? ?? false,
      total: json['total'] as int? ?? 0,
      verified: json['verified'] as int? ?? 0,
      failed: json['failed'] as int? ?? 0,
      results: resultsRaw
              ?.map((e) => VerifyResult.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  /// Converts this [BatchResult] back to a JSON map.
  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'total': total,
      'verified': verified,
      'failed': failed,
      'results': results.map((e) => e.toJson()).toList(),
    };
  }

  @override
  String toString() =>
      'BatchResult(success: $success, total: $total, verified: $verified, '
      'failed: $failed, results: $results)';
}

/// A single receipt to verify in a batch request.
///
/// Used when building the payload for [ChekiClient.verifyBatch].
class BatchReceipt {
  /// The bank code (e.g. `cbe`, `dashen`).
  final String bank;

  /// The transaction reference number.
  final String reference;

  /// The account number, if required by the bank.
  final String? accountNumber;

  /// The phone number, if required by the bank.
  final String? phoneNumber;

  /// Constructs a [BatchReceipt].
  const BatchReceipt({
    required this.bank,
    required this.reference,
    this.accountNumber,
    this.phoneNumber,
  });

  /// Converts this [BatchReceipt] to a JSON map suitable for the API.
  Map<String, dynamic> toJson() {
    return {
      'bank': bank,
      'reference': reference,
      if (accountNumber != null) 'accountNumber': accountNumber,
      if (phoneNumber != null) 'phoneNumber': phoneNumber,
    };
  }
}
