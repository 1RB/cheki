/// Options for a receipt verification request (`POST /api/verify`).
///
/// [bank] is required, plus [reference] or [qrData]. [accountNumber] is
/// needed by CBE and BOA, [phoneNumber] by CBE Birr (see `BankInfo`).
class VerifyOptions {
  /// Bank id (e.g. `cbe`, `telebirr`, `boa`).
  final String bank;

  /// Transaction reference or receipt link. May be empty when [qrData] is set.
  final String reference;

  /// Account number: BOA, the last 5 digits of the account on the receipt
  /// (a full BOA slip link can carry them); older CBE FT receipts, the
  /// receiving account.
  final String? accountNumber;

  /// Payer phone number (CBE Birr).
  final String? phoneNumber;

  /// Raw QR payload (BOA QR codes, or a receipt link from a QR).
  final String? qrData;

  /// Constructs a [VerifyOptions] instance.
  const VerifyOptions({
    required this.bank,
    this.reference = '',
    this.accountNumber,
    this.phoneNumber,
    this.qrData,
  });

  /// The JSON body for `POST /api/verify`. Empty optional fields are omitted.
  Map<String, dynamic> toJson() {
    return {
      'bank': bank,
      if (reference.isNotEmpty) 'reference': reference,
      if (accountNumber != null && accountNumber!.isNotEmpty) 'accountNumber': accountNumber,
      if (phoneNumber != null && phoneNumber!.isNotEmpty) 'phoneNumber': phoneNumber,
      if (qrData != null && qrData!.isNotEmpty) 'qrData': qrData,
    };
  }
}
