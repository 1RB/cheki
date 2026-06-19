# cheki Go SDK

A Go client library for the [cheki](https://cheki-pi.vercel.app) receipt verification API — a free Ethiopian receipt verification service.

## Features

- ✅ Single receipt verification
- ✅ Batch receipt verification
- ✅ List supported banks
- ✅ Service health checks
- ✅ Context-aware requests (cancellation & timeouts)
- ✅ Configurable base URL, HTTP client, and timeout
- ✅ Standard library only — no external dependencies
- ✅ Idiomatic Go with typed errors

## Installation

```bash
go get github.com/1RB/cheki/sdks/go
```

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/1RB/cheki/sdks/go"
)

func main() {
    client := cheki.NewClient(cheki.WithTimeout(15 * time.Second))

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    result, err := client.Verify(ctx, cheki.VerifyOptions{
        Bank:      "cbe",
        Reference: "123456789",
    })
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Verified: %t\n", result.Verified)
    fmt.Printf("Amount:   %.2f %s\n", result.Amount, result.Currency)
    fmt.Printf("Sender:   %s\n", result.SenderName)
}
```

## Configuration

The client accepts functional options at construction time:

```go
// Use a custom base URL (e.g. for a self-hosted instance)
client := cheki.NewClient(cheki.WithBaseURL("https://cheki.example.com"))

// Supply a fully custom HTTP client
client := cheki.NewClient(cheki.WithHTTPClient(&http.Client{
    Timeout: 60 * time.Second,
}))

// Use a specific timeout with the default client
client := cheki.NewClient(cheki.WithTimeout(60 * time.Second))
```

| Option            | Description                                  | Default                          |
|-------------------|----------------------------------------------|----------------------------------|
| `WithBaseURL`     | Override the API base URL                    | `https://cheki-pi.vercel.app`    |
| `WithHTTPClient`  | Provide a custom `*http.Client`              | `&http.Client{Timeout: 30s}`     |
| `WithTimeout`     | Set the default client timeout               | `30s`                            |

## API Reference

### `NewClient(opts ...Option) *Client`

Creates a new cheki API client.

### `(*Client).Verify(ctx context.Context, opts VerifyOptions) (*VerifyResult, error)`

Verifies a single receipt.

```go
result, err := client.Verify(ctx, cheki.VerifyOptions{
    Bank:          "cbe",
    Reference:     "123456789",
    AccountNumber: "0123456789012", // optional, bank-dependent
    PhoneNumber:   "0912345678",    // optional
    QRData:        "...",           // optional
})
```

### `(*Client).VerifyBatch(ctx context.Context, receipts []VerifyOptions) (*BatchResult, error)`

Verifies multiple receipts in a single request.

```go
result, err := client.VerifyBatch(ctx, []cheki.VerifyOptions{
    {Bank: "cbe", Reference: "123456789"},
    {Bank: "dashen", Reference: "987654321", AccountNumber: "0123456789"},
})
fmt.Printf("Verified %d of %d\n", result.Verified, result.Total)
```

### `(*Client).GetBanks(ctx context.Context) ([]BankInfo, error)`

Lists all banks supported by the service.

```go
banks, err := client.GetBanks(ctx)
for _, b := range banks {
    fmt.Printf("%s (%s) — %s\n", b.Name, b.Code, b.Status)
}
```

### `(*Client).GetHealth(ctx context.Context) (*HealthStatus, error)`

Checks the health of the cheki service.

```go
health, err := client.GetHealth(ctx)
fmt.Printf("Status: %s, Version: %s\n", health.Status, health.Version)
```

## Types

### `VerifyOptions`

| Field          | Type   | Required | Description                          |
|----------------|--------|----------|--------------------------------------|
| `Bank`         | string | yes      | Bank code (e.g. `"cbe"`, `"dashen"`) |
| `Reference`    | string | yes      | Transaction reference number         |
| `AccountNumber`| string | no       | Account number (bank-dependent)      |
| `PhoneNumber`  | string | no       | Phone number (bank-dependent)        |
| `QRData`       | string | no       | Raw QR data payload                  |

### `VerifyResult`

| Field          | Type    | Description                      |
|----------------|---------|----------------------------------|
| `Success`      | bool    | Whether the request succeeded    |
| `Verified`     | bool    | Whether the receipt was verified |
| `Bank`         | string  | Bank code                        |
| `Reference`    | string  | Transaction reference            |
| `SenderName`   | string  | Sender's name                    |
| `ReceiverName` | string  | Receiver's name                  |
| `Amount`       | float64 | Transaction amount               |
| `Currency`     | string  | Currency code                    |
| `Date`         | string  | Transaction date                 |
| `SourceURL`    | string  | Source verification URL          |
| `Error`        | string  | Error message (if any)           |

### `BankInfo`

| Field             | Type   | Description                              |
|-------------------|--------|------------------------------------------|
| `Code`            | string | Bank code                                |
| `Name`            | string | Bank name                                |
| `Status`          | string | Bank status (e.g. `"active"`)            |
| `RequiresAccount` | bool   | Whether account number is required       |

### `BatchResult`

| Field     | Type             | Description                          |
|-----------|------------------|--------------------------------------|
| `Success` | bool             | Whether the request succeeded        |
| `Total`   | int              | Total receipts submitted             |
| `Verified`| int              | Number verified                      |
| `Failed`  | int              | Number that failed                   |
| `Results` | []VerifyResult   | Per-receipt verification results     |

### `HealthStatus`

| Field       | Type          | Description                        |
|-------------|---------------|------------------------------------|
| `Success`   | bool          | Whether the request succeeded      |
| `Status`    | string        | Overall service status             |
| `Version`   | string        | API version                        |
| `Timestamp` | string        | Server timestamp                   |
| `Checks`    | []HealthCheck | Individual health check entries    |

## Error Handling

The client returns wrapped errors with the `"cheki:"` prefix. HTTP errors (status ≥ 400) are returned as `*cheki.APIError`, which exposes `StatusCode`, `Body`, and `Message`:

```go
result, err := client.Verify(ctx, opts)
if err != nil {
    var apiErr *cheki.APIError
    if errors.As(err, &apiErr) {
        fmt.Printf("API error %d: %s\n", apiErr.StatusCode, apiErr.Body)
    }
    log.Fatal(err)
}
```

## Context & Timeouts

All methods accept a `context.Context` as their first argument, enabling deadlines and cancellation:

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Verify(ctx, opts)
// Request is cancelled if it exceeds 10 seconds.
```

## Examples

See [`examples/basic/main.go`](examples/basic/main.go) for a complete runnable example covering health checks, bank listing, single verification, and batch verification.

```bash
cd examples/basic
go run main.go
```

## License

MIT
