// Basic example demonstrating the cheki Go SDK.
//
// Run:
//
//	go run examples/basic/main.go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/1RB/cheki/sdks/go"
)

func main() {
	// Create a client with a 15-second timeout.
	client := cheki.NewClient(cheki.WithTimeout(15 * time.Second))

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 1. Check service health.
	fmt.Println("=== Health ===")
	health, err := client.GetHealth(ctx)
	if err != nil {
		log.Printf("health check failed: %v", err)
	} else {
		fmt.Printf("Status:    %s\n", health.Status)
		fmt.Printf("Version:   %s\n", health.Version)
		fmt.Printf("Timestamp: %s\n", health.Timestamp)
	}

	// 2. List supported banks.
	fmt.Println("\n=== Banks ===")
	banks, err := client.GetBanks(ctx)
	if err != nil {
		log.Printf("failed to list banks: %v", err)
	} else {
		fmt.Printf("Found %d banks:\n", len(banks))
		for _, b := range banks {
			fmt.Printf("  - %s (%s): %s (requires account: %t)\n",
				b.Name, b.Code, b.Status, b.RequiresAccount)
		}
	}

	// 3. Verify a single receipt.
	fmt.Println("\n=== Verify ===")
	result, err := client.Verify(ctx, cheki.VerifyOptions{
		Bank:      "cbe",
		Reference: "123456789",
	})
	if err != nil {
		log.Printf("verification failed: %v", err)
	} else {
		printResult(result)
	}

	// 4. Verify multiple receipts in batch.
	fmt.Println("\n=== Batch Verify ===")
	batchResult, err := client.VerifyBatch(ctx, []cheki.VerifyOptions{
		{Bank: "cbe", Reference: "123456789"},
		{Bank: "dashen", Reference: "987654321", AccountNumber: "0123456789"},
	})
	if err != nil {
		log.Printf("batch verification failed: %v", err)
	} else {
		fmt.Printf("Total: %d, Verified: %d, Failed: %d\n",
			batchResult.Total, batchResult.Verified, batchResult.Failed)
		for i, r := range batchResult.Results {
			fmt.Printf("\n  Result %d:\n", i+1)
			printResult(&r)
		}
	}
}

func printResult(r *cheki.VerifyResult) {
	fmt.Printf("  Verified:      %t\n", r.Verified)
	fmt.Printf("  Bank:          %s\n", r.Bank)
	fmt.Printf("  Reference:     %s\n", r.Reference)
	fmt.Printf("  Sender:        %s\n", r.SenderName)
	fmt.Printf("  Receiver:      %s\n", r.ReceiverName)
	fmt.Printf("  Amount:        %.2f %s\n", r.Amount, r.Currency)
	fmt.Printf("  Date:          %s\n", r.Date)
	fmt.Printf("  Source URL:    %s\n", r.SourceURL)
	if r.Error != "" {
		fmt.Printf("  Error:         %s\n", r.Error)
	}
}
