# cheki Dart SDK

A Dart client library for [cheki](https://chekiapp.vercel.app), a free
Ethiopian receipt verification service. Verify bank transfer receipts from
Ethiopian banks via a simple typed API.

## Installation

Add `cheki` to your `pubspec.yaml`:

```yaml
dependencies:
  cheki: ^1.1.0
```

Or use the command line:

```sh
dart pub add cheki
```

## Quick start

```dart
import 'package:cheki/cheki.dart';

void main() async {
  final client = ChekiClient();

  try {
    final result = await client.verify(
      bank: 'cbe',
      reference: 'RT123456789',
      accountNumber: '1000123456789',
    );

    if (result.verified == true) {
      print('Receipt verified!');
      print('Sender:   ${result.senderName}');
      print('Receiver: ${result.receiverName}');
      print('Amount:   ${result.amount} ${result.currency}');
    } else {
      print('Verification failed: ${result.error}');
    }
  } finally {
    client.close();
  }
}
```

## API

### `ChekiClient`

The main client class. Creates an HTTP connection to the cheki API.

| Parameter   | Type           | Default                        | Description                    |
| ----------- | -------------- | ------------------------------ | ------------------------------ |
| `baseUrl`   | `String?`      | `https://chekiapp.vercel.app`  | Override the API base URL.     |
| `client`    | `http.Client?` | `http.Client()`                | Inject a custom HTTP client.   |
| `timeout`   | `Duration?`    | `Duration(seconds: 30)`        | Per-request timeout. `null` disables. |

#### Methods

##### `verify({required String bank, required String reference, String? accountNumber, String? phoneNumber, String? qrData, VerifyOptions? options})`

Verifies a single bank transfer receipt. Returns `Future<VerifyResult>`.

```dart
final result = await client.verify(
  bank: 'cbe',
  reference: 'RT123456789',
  accountNumber: '1000123456789',
);
```

You can also use [VerifyOptions] for a more structured approach:

```dart
final result = await client.verify(
  options: VerifyOptions(
    bank: 'dashen',
    reference: 'FT987654321',
    accountNumber: '5021345678',
  ),
);
```

##### `verifyBatch(List<BatchReceipt> receipts)`

Verifies multiple receipts in a single request. Returns `Future<BatchResult>`.

```dart
final batchResult = await client.verifyBatch([
  BatchReceipt(bank: 'cbe', reference: 'RT111', accountNumber: '10001'),
  BatchReceipt(bank: 'dashen', reference: 'FT222', accountNumber: '50213'),
]);

print('Verified: ${batchResult.verified}/${batchResult.total}');
```

##### `getBanks()`

Lists all banks supported by cheki. Returns `Future<List<BankInfo>>`.

```dart
final banks = await client.getBanks();
for (final bank in banks) {
  print('${bank.code}: ${bank.name} (${bank.status})');
}
```

##### `getHealth()`

Checks the health of the cheki service. Returns `Future<HealthStatus>`.

```dart
final health = await client.getHealth();
print('Status: ${health.status}');
print('Version: ${health.version}');
```

##### `getReceiptUrl(bank, reference)`

Constructs the public-facing URL for viewing a receipt on the cheki web
service. This is a convenience method that does not make an HTTP request.

```dart
final url = client.getReceiptUrl('cbe', 'RT123456789');
print(url); // https://chekiapp.vercel.app/receipt/cbe/RT123456789
```

##### `close()`

Closes the underlying HTTP client. Always call this when done, or use a
`try`/`finally` block.

### Data models

| Class            | Description                                          |
| ---------------- | ---------------------------------------------------- |
| `VerifyResult`   | Result of a single verification.                     |
| `BatchResult`    | Aggregate result of a batch verification.            |
| `BatchReceipt`   | A single receipt within a batch request.             |
| `BankInfo`       | Information about a supported bank.                  |
| `HealthStatus`   | Service health status with individual checks.        |
| `HealthCheck`    | A single health check entry.                         |
| `VerifyOptions`  | Structured options for a verification request.       |

### Timeout

Each HTTP request is subject to a configurable timeout (default: 30 seconds).
Pass a custom `Duration` or `null` to disable:

```dart
final client = ChekiClient(timeout: Duration(seconds: 60));
final clientNoTimeout = ChekiClient(timeout: null);
```

### Retry Logic

The client automatically retries failed requests on HTTP **429** (Too Many
Requests) and **5xx** (Server Error) responses. Up to **3 retry attempts** are
made with exponential backoff (200ms, 400ms, 800ms). Network-level errors
(socket exceptions, client exceptions) and timeouts are not retried.

## Error Handling

API-level errors throw a `ChekiException` with a message, optional HTTP status
code, and the request path:

```dart
try {
  await client.verify(bank: 'cbe', reference: 'invalid');
} on ChekiException catch (e) {
  print('cheki error: ${e.message}');
  print('status code: ${e.statusCode}');
}
```

## Example

A complete example is in [`example/example.dart`](example/example.dart). Run it
with:

```sh
dart run example/example.dart
```

## Development

```sh
# Install dependencies
dart pub get

# Run the analyzer
dart analyze

# Run tests
dart test
```

## License

This SDK is part of the [cheki](https://github.com/1RB/cheki) project.
