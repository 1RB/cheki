/// cheki - a Dart client library for the cheki receipt verification service.
///
/// cheki is a free Ethiopian receipt verification service that allows you to
/// verify bank transfer receipts from Ethiopian banks via a simple REST API.
///
/// ## Quick start
///
/// ```dart
/// import 'package:cheki/cheki.dart';
///
/// void main() async {
///   final client = ChekiClient();
///
///   final result = await client.verify(
///     bank: 'cbe',
///     reference: 'RT123456789',
///     accountNumber: '1000123456789',
///   );
///
///   print(result.verified); // true or false
///   print(result.senderName);
///   print(result.amount);
///
///   client.close();
/// }
/// ```
///
/// See [ChekiClient] for the full API.
library;

export 'src/cheki_client.dart';
export 'src/models.dart';
export 'src/verify_options.dart';
