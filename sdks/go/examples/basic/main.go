// Basic example demonstrating the cheki Go SDK.
//
// Run:
//
//	go run ./examples/basic
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	cheki "github.com/1RB/cheki/sdks/go"
)

func main() {
	// Defaults: 65 s per attempt (the server may take up to 60 s), at most one retry.
	client := cheki.NewClient()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	// 1. Service health (cached up to 5 minutes server-side).
	fmt.Println("=== Health ===")
	health, err := client.GetHealth(ctx)
	if err != nil {
		log.Printf("health check failed: %v", err)
	} else {
		fmt.Printf("Status: %s (checked %s, cached %t)\n", health.Status, health.CheckedAt, health.Cached)
		for _, b := range health.Banks {
			fmt.Printf("  %-10s %-14s %dms\n", b.ID, b.Status, b.LatencyMs)
		}
	}

	// 2. Supported banks. ID is the value to pass as VerifyOptions.Bank.
	fmt.Println("\n=== Banks ===")
	banks, err := client.GetBanks(ctx)
	if err != nil {
		log.Printf("failed to list banks: %v", err)
	} else {
		for _, b := range banks {
			fmt.Printf("  - %s (%s): %s (requires account: %t)\n", b.Name, b.ID, b.Status, b.RequiresAccount)
		}
	}

	// 3. One receipt. Only IsVerified() means the bank confirmed it.
	fmt.Println("\n=== Verify ===")
	result, err := client.Verify(ctx, cheki.VerifyOptions{
		Bank:      "cbe",
		Reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01",
		// Older FT-only CBE receipt (legacy): Reference: "FT26SAMPLE01", AccountNumber: "1000000006171".
	})
	var apiErr *cheki.APIError
	switch {
	case errors.Is(err, cheki.ErrRateLimited) && errors.As(err, &apiErr):
		log.Printf("rate limited, retry in %s", apiErr.RetryAfter)
	case errors.As(err, &apiErr):
		log.Printf("not verified (%d): %s %s", apiErr.StatusCode, apiErr.Message, apiErr.FallbackURL)
	case err != nil:
		log.Printf("request failed: %v", err)
	default:
		printResult(result)
	}

	// 4. Up to 20 receipts in one batch.
	fmt.Println("\n=== Batch Verify ===")
	batch, err := client.VerifyBatch(ctx, []cheki.VerifyOptions{
		{Bank: "cbe", Reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01"},
		{Bank: "telebirr", Reference: "CHQ0FJ403O"},
	})
	if err != nil {
		log.Printf("batch verification failed: %v", err)
		return
	}
	fmt.Printf("Total: %d, Verified: %d, Failed: %d\n", batch.Total, batch.Verified, batch.Failed)
	for _, item := range batch.Results {
		if !item.Success {
			fmt.Printf("  [%d] error %d: %s\n", item.Index, item.Status, item.Error)
			continue
		}
		fmt.Printf("  [%d]\n", item.Index)
		printResult(&item.VerifyResult)
	}
}

func printResult(r *cheki.VerifyResult) {
	switch {
	case r.IsVerified():
		fmt.Println("  VERIFIED by the bank")
	case r.DecodedOnly:
		fmt.Println("  NOT VERIFIED: decoded from a QR code, the bank could not confirm it")
	default:
		fmt.Println("  NOT VERIFIED")
	}
	fmt.Printf("  Bank:      %s\n", r.Bank)
	fmt.Printf("  Reference: %s\n", r.Reference)
	fmt.Printf("  Sender:    %s\n", r.SenderName)
	fmt.Printf("  Receiver:  %s\n", r.ReceiverName)
	fmt.Printf("  Amount:    %.2f %s\n", r.Amount, r.Currency)
	fmt.Printf("  Date:      %s\n", r.Date)
}
