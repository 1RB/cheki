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

  /// The bank code (alternate field, same as [bank]).
  final String? bankCode;

  /// The transaction reference number.
  final String? reference;

  /// The source URL from which the receipt was fetched/verified.
  final String? sourceUrl;

  /// The name of the sender on the verified receipt.
  final String? senderName;

  /// The sender's account number.
  final String? senderAccount;

  /// The name of the receiver on the verified receipt.
  final String? receiverName;

  /// The receiver's account number.
  final String? receiverAccount;

  /// The monetary amount of the transfer.
  final double? amount;

  /// The currency code (e.g. `ETB`).
  final String? currency;

  /// The date of the transaction (as reported by the bank).
  final String? date;

  /// The bank branch where the transaction occurred.
  final String? branch;

  /// The reason for failure or a description of the result.
  final String? reason;

  /// The verification duration in milliseconds.
  final int? durationMs;

  /// The invoice number associated with the transaction.
  final String? invoiceNumber;

  /// The transaction status (e.g. `completed`, `pending`).
  final String? transactionStatus;

  /// The settled amount for the transaction.
  final double? settledAmount;

  /// The stamp duty applied to the transaction.
  final double? stampDuty;

  /// The discount amount applied to the transaction.
  final double? discountAmount;

  /// The service fee charged for the transaction.
  final double? serviceFee;

  /// The VAT on the service fee.
  final double? serviceFeeVat;

  /// The total amount paid.
  final double? totalPaid;

  /// The transaction amount expressed in words.
  final String? amountInWords;

  /// The payment mode (e.g. `online`, `branch`).
  final String? paymentMode;

  /// The payment channel (e.g. `mobile`, `web`).
  final String? paymentChannel;

  /// The bank account number associated with the payment.
  final String? bankAccountNumber;

  /// The bank account name associated with the payment.
  final String? bankAccountName;

  /// An error message if verification failed or the request was unsuccessful.
  final String? error;

  /// Constructs a [VerifyResult] from its fields.
  const VerifyResult({
    required this.success,
    this.verified,
    this.bank,
    this.bankCode,
    this.reference,
    this.sourceUrl,
    this.senderName,
    this.senderAccount,
    this.receiverName,
    this.receiverAccount,
    this.amount,
    this.currency,
    this.date,
    this.branch,
    this.reason,
    this.durationMs,
    this.invoiceNumber,
    this.transactionStatus,
    this.settledAmount,
    this.stampDuty,
    this.discountAmount,
    this.serviceFee,
    this.serviceFeeVat,
    this.totalPaid,
    this.amountInWords,
    this.paymentMode,
    this.paymentChannel,
    this.bankAccountNumber,
    this.bankAccountName,
    this.error,
  });

  /// Creates a [VerifyResult] from a decoded JSON map.
  factory VerifyResult.fromJson(Map<String, dynamic> json) {
    return VerifyResult(
      success: json['success'] as bool? ?? false,
      verified: json['verified'] as bool?,
      bank: json['bank'] as String?,
      bankCode: json['bankCode'] as String?,
      reference: json['reference'] as String?,
      sourceUrl: json['sourceUrl'] as String?,
      senderName: json['senderName'] as String?,
      senderAccount: json['senderAccount'] as String?,
      receiverName: json['receiverName'] as String?,
      receiverAccount: json['receiverAccount'] as String?,
      amount: (json['amount'] as num?)?.toDouble(),
      currency: json['currency'] as String?,
      date: json['date'] as String?,
      branch: json['branch'] as String?,
      reason: json['reason'] as String?,
      durationMs: json['durationMs'] as int?,
      invoiceNumber: json['invoiceNumber'] as String?,
      transactionStatus: json['transactionStatus'] as String?,
      settledAmount: (json['settledAmount'] as num?)?.toDouble(),
      stampDuty: (json['stampDuty'] as num?)?.toDouble(),
      discountAmount: (json['discountAmount'] as num?)?.toDouble(),
      serviceFee: (json['serviceFee'] as num?)?.toDouble(),
      serviceFeeVat: (json['serviceFeeVat'] as num?)?.toDouble(),
      totalPaid: (json['totalPaid'] as num?)?.toDouble(),
      amountInWords: json['amountInWords'] as String?,
      paymentMode: json['paymentMode'] as String?,
      paymentChannel: json['paymentChannel'] as String?,
      bankAccountNumber: json['bankAccountNumber'] as String?,
      bankAccountName: json['bankAccountName'] as String?,
      error: json['error'] as String?,
    );
  }

  /// Converts this result back to a JSON map.
  Map<String, dynamic> toJson() {
    return {
      'success': success,
      if (verified != null) 'verified': verified,
      if (bank != null) 'bank': bank,
      if (bankCode != null) 'bankCode': bankCode,
      if (reference != null) 'reference': reference,
      if (sourceUrl != null) 'sourceUrl': sourceUrl,
      if (senderName != null) 'senderName': senderName,
      if (senderAccount != null) 'senderAccount': senderAccount,
      if (receiverName != null) 'receiverName': receiverName,
      if (receiverAccount != null) 'receiverAccount': receiverAccount,
      if (amount != null) 'amount': amount,
      if (currency != null) 'currency': currency,
      if (date != null) 'date': date,
      if (branch != null) 'branch': branch,
      if (reason != null) 'reason': reason,
      if (durationMs != null) 'durationMs': durationMs,
      if (invoiceNumber != null) 'invoiceNumber': invoiceNumber,
      if (transactionStatus != null) 'transactionStatus': transactionStatus,
      if (settledAmount != null) 'settledAmount': settledAmount,
      if (stampDuty != null) 'stampDuty': stampDuty,
      if (discountAmount != null) 'discountAmount': discountAmount,
      if (serviceFee != null) 'serviceFee': serviceFee,
      if (serviceFeeVat != null) 'serviceFeeVat': serviceFeeVat,
      if (totalPaid != null) 'totalPaid': totalPaid,
      if (amountInWords != null) 'amountInWords': amountInWords,
      if (paymentMode != null) 'paymentMode': paymentMode,
      if (paymentChannel != null) 'paymentChannel': paymentChannel,
      if (bankAccountNumber != null) 'bankAccountNumber': bankAccountNumber,
      if (bankAccountName != null) 'bankAccountName': bankAccountName,
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
        other.bankCode == bankCode &&
        other.reference == reference &&
        other.sourceUrl == sourceUrl &&
        other.senderName == senderName &&
        other.senderAccount == senderAccount &&
        other.receiverName == receiverName &&
        other.receiverAccount == receiverAccount &&
        other.amount == amount &&
        other.currency == currency &&
        other.date == date &&
        other.branch == branch &&
        other.reason == reason &&
        other.durationMs == durationMs &&
        other.invoiceNumber == invoiceNumber &&
        other.transactionStatus == transactionStatus &&
        other.settledAmount == settledAmount &&
        other.stampDuty == stampDuty &&
        other.discountAmount == discountAmount &&
        other.serviceFee == serviceFee &&
        other.serviceFeeVat == serviceFeeVat &&
        other.totalPaid == totalPaid &&
        other.amountInWords == amountInWords &&
        other.paymentMode == paymentMode &&
        other.paymentChannel == paymentChannel &&
        other.bankAccountNumber == bankAccountNumber &&
        other.bankAccountName == bankAccountName &&
        other.error == error;
  }

  @override
  int get hashCode => Object.hash(
        success,
        verified,
        bank,
        bankCode,
        reference,
        sourceUrl,
        senderName,
        senderAccount,
        receiverName,
        receiverAccount,
        amount,
        currency,
        date,
        branch,
        reason,
        durationMs,
        invoiceNumber,
        transactionStatus,
        settledAmount,
        stampDuty,
        discountAmount,
        serviceFee,
        serviceFeeVat,
        totalPaid,
        amountInWords,
        paymentMode,
        paymentChannel,
        bankAccountNumber,
        bankAccountName,
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
  /// Common values: `live`, `in-development`.
  final String status;

  /// The type of financial institution (`bank` or `wallet`).
  final String? type;

  /// Whether the bank requires an account number for verification.
  final bool requiresAccount;

  /// The expected number of digits in the account number, if applicable.
  final int? accountDigits;

  /// Whether the bank requires a phone number for verification.
  final bool? requiresPhone;

  /// Whether QR-based verification is supported for this bank.
  final bool? supportsQr;

  /// The response type expected from this bank's verification endpoint.
  final String? responseType;

  /// The bank's verification endpoint URL.
  final String? endpoint;

  /// Whether SSL verification is used for this bank's endpoint.
  final bool? sslVerify;

  /// Additional notes about this bank integration.
  final String? notes;

  /// The brand color associated with this bank.
  final String? color;

  /// The initials or short abbreviation for this bank.
  final String? initials;

  /// Constructs a [BankInfo] from its fields.
  const BankInfo({
    required this.code,
    required this.name,
    required this.status,
    this.type,
    required this.requiresAccount,
    this.accountDigits,
    this.requiresPhone,
    this.supportsQr,
    this.responseType,
    this.endpoint,
    this.sslVerify,
    this.notes,
    this.color,
    this.initials,
  });

  /// Creates a [BankInfo] from a decoded JSON map.
  factory BankInfo.fromJson(Map<String, dynamic> json) {
    return BankInfo(
      code: json['code'] as String,
      name: json['name'] as String,
      status: json['status'] as String,
      type: json['type'] as String?,
      requiresAccount: json['requiresAccount'] as bool? ?? false,
      accountDigits: json['accountDigits'] as int?,
      requiresPhone: json['requiresPhone'] as bool?,
      supportsQr: json['supportsQr'] as bool?,
      responseType: json['responseType'] as String?,
      endpoint: json['endpoint'] as String?,
      sslVerify: json['sslVerify'] as bool?,
      notes: json['notes'] as String?,
      color: json['color'] as String?,
      initials: json['initials'] as String?,
    );
  }

  /// Converts this [BankInfo] back to a JSON map.
  Map<String, dynamic> toJson() {
    return {
      'code': code,
      'name': name,
      'status': status,
      if (type != null) 'type': type,
      'requiresAccount': requiresAccount,
      if (accountDigits != null) 'accountDigits': accountDigits,
      if (requiresPhone != null) 'requiresPhone': requiresPhone,
      if (supportsQr != null) 'supportsQr': supportsQr,
      if (responseType != null) 'responseType': responseType,
      if (endpoint != null) 'endpoint': endpoint,
      if (sslVerify != null) 'sslVerify': sslVerify,
      if (notes != null) 'notes': notes,
      if (color != null) 'color': color,
      if (initials != null) 'initials': initials,
    };
  }

  /// Whether this bank is live and available.
  bool get isLive => status == 'live';

  /// Whether this bank is a bank (as opposed to a wallet).
  bool get isBank => type == 'bank';

  /// Whether this bank is a wallet (as opposed to a bank).
  bool get isWallet => type == 'wallet';

  @override
  String toString() =>
      'BankInfo(code: $code, name: $name, status: $status, type: $type, '
      'requiresAccount: $requiresAccount)';

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is BankInfo &&
        other.code == code &&
        other.name == name &&
        other.status == status &&
        other.type == type &&
        other.requiresAccount == requiresAccount &&
        other.accountDigits == accountDigits &&
        other.requiresPhone == requiresPhone &&
        other.supportsQr == supportsQr &&
        other.responseType == responseType &&
        other.endpoint == endpoint &&
        other.sslVerify == sslVerify &&
        other.notes == notes &&
        other.color == color &&
        other.initials == initials;
  }

  @override
  int get hashCode => Object.hash(
        code,
        name,
        status,
        type,
        requiresAccount,
        accountDigits,
        requiresPhone,
        supportsQr,
        responseType,
        endpoint,
        sslVerify,
        notes,
        color,
        initials,
      );
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
