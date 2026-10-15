# cheki Go SDK

Go client for the [cheki](https://cheki.et) receipt verification API: verify Ethiopian bank transfer receipts from CBE, Telebirr, BOA, Dashen, M-Pesa (beta: not yet confirmed with a real receipt), Awash, Siinqee, eBirr and ZamZam (beta: one receipt shape confirmed so far) (the live banks; `GetBanks` lists the current set).

Website: [cheki.et](https://cheki.et) · API reference: [cheki.et/docs](https://cheki.et/docs) · Integration guide and every SDK: [cheki.et/developers](https://cheki.et/developers) · Supported banks: [cheki.et/banks](https://cheki.et/banks)

```bash
go get github.com/1RB/cheki/sdks/go
```

Releases are tagged `sdks/go/vX.Y.Z` (the Go convention for a module in a subdirectory), so `go get` resolves the newest tagged version; pin one with `go get github.com/1RB/cheki/sdks/go@v1.5.0`. Docs: [pkg.go.dev](https://pkg.go.dev/github.com/1RB/cheki/sdks/go).

## Quick start

```go
package main

import (
	"context"
	"errors"
	"fmt"

	cheki "github.com/1RB/cheki/sdks/go"
)

func main() {
	client := cheki.NewClient() // 65 s per attempt, at most 1 retry

	// CBE: the receipt link (or just its Receipt ID) from the CBE app. No account number needed.
	result, err := client.Verify(context.Background(), cheki.VerifyOptions{
		Bank:      "cbe",
		Reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01",
	})
	var apiErr *cheki.APIError
	switch {
	case errors.Is(err, cheki.ErrRateLimited) && errors.As(err, &apiErr):
		fmt.Println("rate limited, retry in", apiErr.RetryAfter)
	case errors.As(err, &apiErr):
		fmt.Println(apiErr.StatusCode, apiErr.Message, apiErr.FallbackURL)
	case err != nil:
		fmt.Println("request failed:", err)
	case result.IsVerified():
		fmt.Println("verified:", result.Amount, result.SenderName)
	default:
		fmt.Println("NOT verified (decoded only:", result.DecodedOnly, ")")
	}
}
```

### `Verified` is the only success signal

`Verify` returns a result for HTTP 200, and a 200 can still be unverified: a BOA QR code that BOA could not confirm comes back with `Success: true, Verified: false, DecodedOnly: true`. A QR code can be forged. Use `result.IsVerified()`.

QR-only (BOA): `client.Verify(ctx, cheki.VerifyOptions{Bank: "boa", QRData: "3cHRaxVjn/pySp..."})`.

### Batch (max 20)

```go
batch, err := client.VerifyBatch(ctx, []cheki.VerifyOptions{
	{Bank: "cbe", Reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01"},
	{Bank: "telebirr", Reference: "CHQ0FJ403O"},
})
// batch.Total, batch.Verified (only Verified: true), batch.Failed (everything else), batch.Cached
for _, item := range batch.Results {
	if !item.Success {
		fmt.Println(item.Index, item.Status, item.Error) // e.g. 422 "Receipt not found"
		continue
	}
	fmt.Println(item.Index, item.IsVerified(), item.Amount)
}
```

More than 20 receipts returns `ErrBatchTooLarge` without a request. Each receipt also counts against the per-IP verify limit (30 per minute), and a batch is never retried after a 5xx or network error, so send long lists in chunks of `cheki.RecommendedBatchChunk` (15). A failed item has `Status` and `Error`, plus `FallbackURL` when the server sends one for a geo-blocked bank. Results carry `OrderID` when the receipt has one (CBE Birr), and `BankInfo.Beta` is true for M-Pesa and ZamZam.

### Banks and health

```go
banks, _ := client.GetBanks(ctx)
for _, b := range banks {
	fmt.Println(b.ID, b.Name, b.Type, b.Status, b.RequiresAccount, b.AccountDigits, b.RequiresPhone)
} // b.Code is a deprecated alias of b.ID

health, _ := client.GetHealth(ctx) // cached up to 5 minutes server-side
for _, b := range health.Banks {
	fmt.Println(b.ID, b.Status, b.LatencyMs) // reachable | unreachable | geo-blocked | no-parser | in-development
}
```

### Receipt download links

```go
u, err := client.GetReceiptURL("cbe", "fHCxExampleRcpt01", "")
// https://cheki.et/api/receipt?bank=cbe&reference=fHCxExampleRcpt01
```

Only `cbe`, `zemen`, `dashen` and `zamzam`; anything else returns `ErrInvalidInput`, and so does a ZamZam receipt id that is not digits only. CBE, Dashen and ZamZam links redirect to the bank's own receipt page; Zemen (and older CBE receipts) are served as the bank's PDF.

### Older receipts

Older CBE receipts that only show an FT reference still work as a legacy format: pass the receiving account (at least the last 8 digits). CBE's older receipt service is often unreachable, so prefer the receipt link when you have it.

```go
result, err := client.Verify(ctx, cheki.VerifyOptions{Bank: "cbe", Reference: "FT26140P01YB", AccountNumber: "1000560536171"})
u, err := client.GetReceiptURL("cbe", "FT26140P01YB", "1000560536171") // the bank's PDF
```

## Errors

Non-2xx responses are `*APIError` with `StatusCode`, `Message` (the server's text), `FallbackURL` (geo-blocked banks), `RetryAfter` (-1 when not sent) and `Body`. `errors.Is(err, cheki.ErrRateLimited)` matches 429 and `errors.Is(err, cheki.ErrPayloadTooLarge)` matches 413. Timeouts match `errors.Is(err, context.DeadlineExceeded)`.

Status codes: 400 bad input, 404 unsupported bank, 413 too large, 422 receipt not found or failed verification, 429 rate limited, 502 bank unreachable or geo-blocked, 500 internal error.

## Timeouts and retries

- `DefaultTimeout` is **65 s per attempt** (the server may spend up to 60 s). `WithTimeout` works with or without `WithHTTPClient`, in any order.
- **At most one retry** (`MaxRetries = 1`, `WithMaxRetries(0)` disables it), and only where it is safe (the same rule in every cheki SDK):
  - `GET` (banks, health): a network error or a 5xx.
  - verify: a network error, or a 429/503 whose `Retry-After` is at most 60 s.
  - batch: only a 429/503 with a short `Retry-After`. Never a network error or a 5xx: a 504 means the batch ran out of server time, and replaying it would hit every bank again and charge every receipt against the rate limit.
  - Never: timeouts, other 4xx, a geo-blocked bank (502 with `fallbackUrl`), or any error the server marks `retryable: false`. A 500/502/504 on verify is not retried either: the server already ran the check, with its own 2 attempts per bank.
- The retry waits for `Retry-After`; a network-error retry waits 1-2 s. A cancelled context is never retried.
- The server tries each bank at most 2 times, so one call reaches the bank at most **4 times**.

## Tests

`go test ./...` decodes the shared fixtures in `../fixtures/api-contract.json`, which the repo's `tests/contract` suite checks against the real route handlers.
