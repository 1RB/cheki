/// Options for configuring a receipt verification request.
///
/// This class provides a typed way to specify the optional parameters
/// supported by the cheki `POST /api/verify` endpoint. At minimum,
/// [bank] and [reference] are required; the remaining fields are
/// conditionally required depending on the bank.
class VerifyOptions {
  /// The bank code identifying which bank to verify against.
  ///
  /// Examples: `cbe` (Commercial Bank of Ethiopia), `dashen`,
  /// `awash`, `abyssinia`.
  final String bank;

  /// The transaction reference number on the receipt.
  final String reference;

  /// The account number associated with the transfer.
  ///
  /// Required by some banks — check [BankInfo.requiresAccount].
  final String? accountNumber;

  /// The phone number associated with the transfer.
  final String? phoneNumber;

  /// Raw QR data extracted from a receipt QR code, if available.
  final String? qrData;

  /// Constructs a [VerifyOptions] instance.
  ///
  /// [bank] and [reference] are required. Provide [accountNumber],
  /// [phoneNumber], or [qrData] as needed by the specific bank.
  const VerifyOptions({
    required this.bank,
    required this.reference,
    this.accountNumber,
    this.phoneNumber,
    this.qrData,
  });

  /// Converts these options into the JSON map expected by `POST /api/verify`.
  Map<String, dynamic> toJson() {
    return {
      'bank': bank,
      'reference': reference,
      if (accountNumber != null) 'accountNumber': accountNumber,
      if (phoneNumber != null) 'phoneNumber': phoneNumber,
      if (qrData != null) 'qrData': qrData,
    };
  }
}
