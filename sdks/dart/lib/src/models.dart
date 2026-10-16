/// Data models returned by the cheki API.
library;

import 'dart:convert';

double? _toDouble(Object? v) => v is num ? v.toDouble() : null;
int? _toInt(Object? v) => v is num ? v.toInt() : null;
String? _toStr(Object? v) => v is String ? v : null;

/// The result of a verification: `POST /api/verify`, or one item of a batch.
///
/// [success] only means the request was processed. [verified] (or
/// [isVerified]) is the ONLY success signal: a BOA QR code that could not be
/// confirmed with the bank comes back with `success: true`,
/// `verified: false` and [decodedOnly] `true`.
class VerifyResult {
  /// Whether the request was processed (false for failed batch items).
  final bool success;

  /// True only when the bank itself confirmed the receipt.
  final bool verified;

  /// BOA QR only: decrypted but not confirmed with the bank. Never proof of payment.
  final bool decodedOnly;

  /// `/api/parse` only: parsed from caller-supplied text, never checked with the bank.
  final bool parsed;

  /// `/api/parse` only: `client-supplied`.
  final String? source;

  /// `/api/parse` only: a human label for the unverified result.
  final String? label;

  /// True when the server answered from its receipt cache.
  final bool cached;

  /// Bank name (human-readable).
  final String? bank;

  /// Bank id (e.g. `cbe`).
  final String? bankCode;
  final String? reference;
  final String? sourceUrl;
  final String? senderName;
  final String? senderAccount;
  final String? receiverName;
  final String? receiverAccount;
  final double? amount;
  final String? currency;
  final String? date;
  final String? branch;
  final String? reason;
  final String? transactionType;

  /// Server processing time; absent on cache hits.
  final int? durationMs;
  final String? invoiceNumber;
  final String? transactionStatus;
  final double? settledAmount;
  final double? stampDuty;
  final double? discountAmount;
  final double? serviceFee;
  final double? serviceFeeVat;
  final double? totalPaid;
  final String? amountInWords;
  final String? paymentMode;
  final String? paymentChannel;
  final String? bankAccountNumber;
  final String? bankAccountName;

  /// Order ID printed on the receipt (CBE Birr).
  final String? orderId;

  /// Error text (failed batch items).
  final String? error;

  /// A failed batch item for a geo-blocked bank, when the server sends it:
  /// open this link in a browser in Ethiopia instead.
  final String? fallbackUrl;

  /// Failed batch items: the HTTP status a single verify would have returned.
  final int? status;

  /// Position in the batch input (batch items only, set by the SDK).
  final int? index;

  /// Constructs a [VerifyResult].
  const VerifyResult({
    required this.success,
    this.verified = false,
    this.decodedOnly = false,
    this.parsed = false,
    this.source,
    this.label,
    this.cached = false,
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
    this.transactionType,
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
    this.orderId,
    this.error,
    this.fallbackUrl,
    this.status,
    this.index,
  });

  /// True only when the bank confirmed the receipt. [success], [decodedOnly]
  /// and [parsed] are not proof of payment.
  bool get isVerified => success && verified;

  /// Creates a [VerifyResult] from a decoded JSON map.
  factory VerifyResult.fromJson(Map<String, dynamic> json, {int? index}) {
    return VerifyResult(
      success: json['success'] == true,
      verified: json['verified'] == true,
      decodedOnly: json['decodedOnly'] == true,
      parsed: json['parsed'] == true,
      source: _toStr(json['source']),
      label: _toStr(json['label']),
      cached: json['cached'] == true,
      bank: _toStr(json['bank']),
      bankCode: _toStr(json['bankCode']),
      reference: _toStr(json['reference']),
      sourceUrl: _toStr(json['sourceUrl']),
      senderName: _toStr(json['senderName']),
      senderAccount: _toStr(json['senderAccount']),
      receiverName: _toStr(json['receiverName']),
      receiverAccount: _toStr(json['receiverAccount']),
      amount: _toDouble(json['amount']),
      currency: _toStr(json['currency']),
      date: _toStr(json['date']),
      branch: _toStr(json['branch']),
      reason: _toStr(json['reason']),
      transactionType: _toStr(json['transactionType']),
      durationMs: _toInt(json['durationMs']),
      invoiceNumber: _toStr(json['invoiceNumber']),
      transactionStatus: _toStr(json['transactionStatus']),
      settledAmount: _toDouble(json['settledAmount']),
      stampDuty: _toDouble(json['stampDuty']),
      discountAmount: _toDouble(json['discountAmount']),
      serviceFee: _toDouble(json['serviceFee']),
      serviceFeeVat: _toDouble(json['serviceFeeVat']),
      totalPaid: _toDouble(json['totalPaid']),
      amountInWords: _toStr(json['amountInWords']),
      paymentMode: _toStr(json['paymentMode']),
      paymentChannel: _toStr(json['paymentChannel']),
      bankAccountNumber: _toStr(json['bankAccountNumber']),
      bankAccountName: _toStr(json['bankAccountName']),
      orderId: _toStr(json['orderId']),
      error: _toStr(json['error']),
      fallbackUrl: _toStr(json['fallbackUrl']),
      status: _toInt(json['status']),
      index: index,
    );
  }

  /// Converts this result back to a JSON map (API field names).
  Map<String, dynamic> toJson() {
    final m = <String, dynamic>{
      'success': success,
      'verified': verified,
      if (decodedOnly) 'decodedOnly': true,
      if (parsed) 'parsed': true,
      'source': source,
      'label': label,
      if (cached) 'cached': true,
      'bank': bank,
      'bankCode': bankCode,
      'reference': reference,
      'sourceUrl': sourceUrl,
      'senderName': senderName,
      'senderAccount': senderAccount,
      'receiverName': receiverName,
      'receiverAccount': receiverAccount,
      'amount': amount,
      'currency': currency,
      'date': date,
      'branch': branch,
      'reason': reason,
      'transactionType': transactionType,
      'durationMs': durationMs,
      'invoiceNumber': invoiceNumber,
      'transactionStatus': transactionStatus,
      'settledAmount': settledAmount,
      'stampDuty': stampDuty,
      'discountAmount': discountAmount,
      'serviceFee': serviceFee,
      'serviceFeeVat': serviceFeeVat,
      'totalPaid': totalPaid,
      'amountInWords': amountInWords,
      'paymentMode': paymentMode,
      'paymentChannel': paymentChannel,
      'bankAccountNumber': bankAccountNumber,
      'bankAccountName': bankAccountName,
      'orderId': orderId,
      'error': error,
      'fallbackUrl': fallbackUrl,
      'status': status,
    };
    m.removeWhere((_, v) => v == null);
    return m;
  }

  @override
  String toString() => 'VerifyResult(success: $success, verified: $verified, decodedOnly: $decodedOnly, '
      'bank: $bank, reference: $reference, amount: $amount, currency: $currency, error: $error)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is VerifyResult && other.index == index && jsonEncode(other.toJson()) == jsonEncode(toJson()));

  @override
  int get hashCode => Object.hash(index, jsonEncode(toJson()));
}

/// A supported bank or wallet from `GET /api/banks`.
class BankInfo {
  /// Bank id, the value to pass as `bank` (e.g. `cbe`).
  final String id;

  /// Human-readable name.
  final String name;
  final String? swift;

  /// `bank`, `mobile` or `wallet`.
  final String? type;

  /// `live` or `in-development`.
  final String status;

  /// Live, but not yet confirmed with enough real receipts (M-Pesa and
  /// ZamZam today).
  final bool beta;
  final bool requiresAccount;

  /// Trailing account digits the bank needs, when it needs an account.
  final int? accountDigits;

  /// Whether a payer phone number is required (defaults to false).
  final bool requiresPhone;

  /// URL template of the bank's current format (informational).
  final String? endpoint;
  final String? color;
  final String? initials;

  /// Receipt formats, current first. Lead with the first `supported` one; the
  /// rest are older receipts. Empty when the server is older than this SDK.
  final List<ReceiptFormat> formats;

  /// Constructs a [BankInfo].
  const BankInfo({
    required this.id,
    required this.name,
    required this.status,
    this.swift,
    this.type,
    this.beta = false,
    this.requiresAccount = false,
    this.accountDigits,
    this.requiresPhone = false,
    this.endpoint,
    this.color,
    this.initials,
    this.formats = const [],
  });

  /// Deprecated alias of [id].
  @Deprecated('Use id')
  String get code => id;

  /// Creates a [BankInfo] from a decoded JSON map. Tolerates a missing id.
  factory BankInfo.fromJson(Map<String, dynamic> json) {
    return BankInfo(
      id: _toStr(json['id']) ?? _toStr(json['code']) ?? '',
      name: _toStr(json['name']) ?? '',
      status: _toStr(json['status']) ?? 'unknown',
      swift: _toStr(json['swift']),
      type: _toStr(json['type']),
      beta: json['beta'] == true,
      requiresAccount: json['requiresAccount'] == true,
      accountDigits: _toInt(json['accountDigits']),
      requiresPhone: json['requiresPhone'] == true,
      endpoint: _toStr(json['endpoint']),
      color: _toStr(json['color']),
      initials: _toStr(json['initials']),
      formats: json['formats'] is List
          ? (json['formats'] as List).whereType<Map<String, dynamic>>().map(ReceiptFormat.fromJson).toList()
          : const [],
    );
  }

  /// Converts this [BankInfo] back to a JSON map.
  Map<String, dynamic> toJson() {
    final m = <String, dynamic>{
      'id': id,
      'name': name,
      'swift': swift,
      'type': type,
      'status': status,
      if (beta) 'beta': true,
      'requiresAccount': requiresAccount,
      'accountDigits': accountDigits,
      'requiresPhone': requiresPhone,
      'endpoint': endpoint,
      'color': color,
      'initials': initials,
      'formats': formats.map((f) => f.toJson()).toList(),
    };
    m.removeWhere((_, v) => v == null);
    return m;
  }

  bool get isLive => status == 'live';
  bool get isBank => type == 'bank';
  bool get isMobile => type == 'mobile';
  bool get isWallet => type == 'wallet';

  @override
  String toString() => 'BankInfo(id: $id, name: $name, status: $status, type: $type, '
      'requiresAccount: $requiresAccount)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) || (other is BankInfo && jsonEncode(other.toJson()) == jsonEncode(toJson()));

  @override
  int get hashCode => jsonEncode(toJson()).hashCode;
}

/// One bank's reachability in `GET /api/health`.
class BankHealth {
  final String id;
  final String name;

  /// `reachable`, `unreachable`, `geo-blocked`, `no-parser` or `in-development`.
  final String status;
  final int latencyMs;

  /// Constructs a [BankHealth].
  const BankHealth({
    required this.id,
    required this.name,
    required this.status,
    required this.latencyMs,
  });

  factory BankHealth.fromJson(Map<String, dynamic> json) => BankHealth(
        id: _toStr(json['id']) ?? '',
        name: _toStr(json['name']) ?? '',
        status: _toStr(json['status']) ?? '',
        latencyMs: _toInt(json['latencyMs']) ?? 0,
      );

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'status': status, 'latencyMs': latencyMs};

  bool get isReachable => status == 'reachable';

  @override
  String toString() => 'BankHealth(id: $id, status: $status, latencyMs: $latencyMs)';
}

/// `GET /api/health`: per-bank reachability, cached up to 5 minutes server-side.
class HealthStatus {
  /// `ok` when the service answered.
  final String status;

  /// When the probe ran (ISO 8601).
  final String? checkedAt;

  /// True when the server answered from its 5-minute cache.
  final bool cached;
  final List<BankHealth> banks;

  /// Constructs a [HealthStatus].
  const HealthStatus({
    required this.status,
    this.checkedAt,
    this.cached = false,
    this.banks = const [],
  });

  factory HealthStatus.fromJson(Map<String, dynamic> json) {
    final raw = json['banks'];
    return HealthStatus(
      status: _toStr(json['status']) ?? 'unknown',
      checkedAt: _toStr(json['checkedAt']),
      cached: json['cached'] == true,
      banks: raw is List ? raw.whereType<Map<String, dynamic>>().map(BankHealth.fromJson).toList() : const [],
    );
  }

  bool get isOk => status == 'ok';

  Map<String, dynamic> toJson() => {
        'status': status,
        if (checkedAt != null) 'checkedAt': checkedAt,
        'cached': cached,
        'banks': banks.map((b) => b.toJson()).toList(),
      };

  @override
  String toString() => 'HealthStatus(status: $status, checkedAt: $checkedAt, cached: $cached, banks: $banks)';
}

/// `POST /api/verify/batch`.
class BatchResult {
  final bool success;
  final int total;

  /// Items with `verified: true`.
  final int verified;

  /// Everything else: errors and decoded-only QR results.
  final int failed;

  /// Items served from the server cache.
  final int cached;

  /// Per-receipt results in input order (each has [VerifyResult.index]).
  final List<VerifyResult> results;

  /// Constructs a [BatchResult].
  const BatchResult({
    required this.success,
    required this.total,
    required this.verified,
    required this.failed,
    required this.results,
    this.cached = 0,
  });

  factory BatchResult.fromJson(Map<String, dynamic> json) {
    final raw = json['results'];
    final results = <VerifyResult>[];
    if (raw is List) {
      for (var i = 0; i < raw.length; i++) {
        final item = raw[i];
        if (item is Map<String, dynamic>) results.add(VerifyResult.fromJson(item, index: i));
      }
    }
    final verifiedCount = results.where((r) => r.isVerified).length;
    return BatchResult(
      success: json['success'] == true,
      total: _toInt(json['total']) ?? results.length,
      verified: _toInt(json['verified']) ?? verifiedCount,
      failed: _toInt(json['failed']) ?? results.length - verifiedCount,
      cached: _toInt(json['cached']) ?? 0,
      results: results,
    );
  }

  Map<String, dynamic> toJson() => {
        'success': success,
        'total': total,
        'verified': verified,
        'failed': failed,
        'cached': cached,
        'results': results.map((e) => e.toJson()).toList(),
      };

  @override
  String toString() => 'BatchResult(success: $success, total: $total, verified: $verified, '
      'failed: $failed, cached: $cached)';
}

/// A receipt to verify in [ChekiClient.verifyBatch].
class BatchReceipt {
  /// Bank id (e.g. `cbe`).
  final String bank;

  /// Reference or receipt link. Optional when [qrData] is given.
  final String? reference;
  final String? accountNumber;
  final String? phoneNumber;
  final String? qrData;

  /// Constructs a [BatchReceipt].
  const BatchReceipt({
    required this.bank,
    this.reference,
    this.accountNumber,
    this.phoneNumber,
    this.qrData,
  });

  Map<String, dynamic> toJson() => {
        'bank': bank,
        if (reference != null && reference!.isNotEmpty) 'reference': reference,
        if (accountNumber != null && accountNumber!.isNotEmpty) 'accountNumber': accountNumber,
        if (phoneNumber != null && phoneNumber!.isNotEmpty) 'phoneNumber': phoneNumber,
        if (qrData != null && qrData!.isNotEmpty) 'qrData': qrData,
      };
}

/// One receipt format of a bank, from `GET /api/banks`.
class ReceiptFormat {
  final String id;

  /// `current`, `legacy` (still works) or `deprecated` (links are only read
  /// for their reference).
  final String status;
  final String label;

  /// What the format needs: `reference`, `receiptId`, `link`, `account`, `phone`.
  final List<String> inputs;

  /// Trailing account digits, when the format needs an account.
  final int? accountDigits;
  final String responseType;

  /// False when cheki documents the format but can't check it yet.
  final bool supported;

  /// `verified` (observed by cheki) or `inferred`.
  final String confidence;

  /// Constructs a [ReceiptFormat].
  const ReceiptFormat({
    required this.id,
    required this.status,
    this.label = '',
    this.inputs = const [],
    this.accountDigits,
    this.responseType = '',
    this.supported = false,
    this.confidence = '',
  });

  /// Creates a [ReceiptFormat] from a decoded JSON map.
  factory ReceiptFormat.fromJson(Map<String, dynamic> json) => ReceiptFormat(
        id: _toStr(json['id']) ?? '',
        status: _toStr(json['status']) ?? '',
        label: _toStr(json['label']) ?? '',
        inputs: json['inputs'] is List ? (json['inputs'] as List).whereType<String>().toList() : const [],
        accountDigits: _toInt(json['accountDigits']),
        responseType: _toStr(json['responseType']) ?? '',
        supported: json['supported'] == true,
        confidence: _toStr(json['confidence']) ?? '',
      );

  /// Converts this [ReceiptFormat] back to a JSON map.
  Map<String, dynamic> toJson() {
    final m = <String, dynamic>{
      'id': id,
      'status': status,
      'label': label,
      'inputs': inputs,
      'accountDigits': accountDigits,
      'responseType': responseType,
      'supported': supported,
      'confidence': confidence,
    };
    m.removeWhere((_, v) => v == null);
    return m;
  }

  bool get isCurrent => status == 'current';
  bool get isLegacy => status == 'legacy';
}
