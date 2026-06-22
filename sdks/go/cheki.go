// Package cheki provides a Go client for the cheki receipt verification API.
//
// cheki is a free Ethiopian receipt verification service available at
// https://chekiapp.vercel.app. This client wraps the REST API, offering
// typed responses, context-aware requests, and idiomatic Go error handling.
//
// Example:
//
//	client := cheki.NewClient()
//	result, err := client.Verify(context.Background(), cheki.VerifyOptions{
//	    Bank:      "cbe",
//	    Reference: "123456789",
//	})
//	if err != nil {
//	    log.Fatal(err)
//	}
//	fmt.Println(result.Verified)
package cheki

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"time"
)

// DefaultBaseURL is the default cheki API endpoint.
const DefaultBaseURL = "https://chekiapp.vercel.app"

// DefaultTimeout is the default HTTP request timeout.
const DefaultTimeout = 30 * time.Second

// Retry configuration.
const (
	maxRetries     = 3
	initialBackoff = 500 * time.Millisecond
	maxBackoff     = 5 * time.Second
)

// Client is the cheki API client.
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// Option configures a Client at construction time.
type Option func(*Client)

// WithBaseURL overrides the default API base URL.
func WithBaseURL(url string) Option {
	return func(c *Client) {
		if url != "" {
			c.baseURL = url
		}
	}
}

// WithHTTPClient supplies a custom *http.Client.
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) {
		if hc != nil {
			c.httpClient = hc
		}
	}
}

// WithTimeout sets the HTTP request timeout for the default client.
// Has no effect if WithHTTPClient is also used.
func WithTimeout(d time.Duration) Option {
	return func(c *Client) {
		c.httpClient = &http.Client{Timeout: d}
	}
}

// NewClient creates a cheki API client with the given options.
func NewClient(opts ...Option) *Client {
	c := &Client{
		baseURL:    DefaultBaseURL,
		httpClient: &http.Client{Timeout: DefaultTimeout},
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Verify verifies a single receipt against the cheki service.
func (c *Client) Verify(ctx context.Context, opts VerifyOptions) (*VerifyResult, error) {
	if opts.Bank == "" {
		return nil, fmt.Errorf("cheki: bank is required")
	}
	if opts.Reference == "" {
		return nil, fmt.Errorf("cheki: reference is required")
	}

	body, err := json.Marshal(opts)
	if err != nil {
		return nil, fmt.Errorf("cheki: failed to marshal request: %w", err)
	}

	var result VerifyResult
	if err := c.post(ctx, "/api/verify", body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// VerifyBatch verifies multiple receipts in a single request.
func (c *Client) VerifyBatch(ctx context.Context, receipts []VerifyOptions) (*BatchResult, error) {
	if len(receipts) == 0 {
		return nil, fmt.Errorf("cheki: at least one receipt is required")
	}

	payload := struct {
		Receipts []VerifyOptions `json:"receipts"`
	}{Receipts: receipts}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("cheki: failed to marshal request: %w", err)
	}

	var result BatchResult
	if err := c.post(ctx, "/api/verify/batch", body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetBanks retrieves the list of banks supported by the cheki service.
func (c *Client) GetBanks(ctx context.Context) ([]BankInfo, error) {
	var resp BanksResponse
	if err := c.get(ctx, "/api/banks", &resp); err != nil {
		return nil, err
	}
	return resp.Banks, nil
}

// GetHealth retrieves the health status of the cheki service.
func (c *Client) GetHealth(ctx context.Context) (*HealthStatus, error) {
	var status HealthStatus
	if err := c.get(ctx, "/api/health", &status); err != nil {
		return nil, err
	}
	return &status, nil
}

// GetReceiptURL constructs the URL for viewing a receipt on the cheki web
// service. This is the public-facing page where a receipt can be viewed
// in a browser - distinct from the API endpoint used for verification.
func (c *Client) GetReceiptURL(bank, reference string) string {
	return fmt.Sprintf("%s/receipt/%s/%s", c.baseURL, bank, reference)
}

// post sends a JSON POST request and decodes the JSON response into target.
func (c *Client) post(ctx context.Context, path string, body []byte, target any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("cheki: failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	return c.do(req, target)
}

// get sends a GET request and decodes the JSON response into target.
func (c *Client) get(ctx context.Context, path string, target any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return fmt.Errorf("cheki: failed to create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	return c.do(req, target)
}

// do executes the request and decodes the JSON response body into target.
//
// It retries up to maxRetries times on HTTP 429 (Too Many Requests) and 5xx
// (Server Error) responses using exponential backoff with jitter. The initial
// backoff is 500ms, doubling each retry, capped at 5s. A random jitter of up
// to 50% of the backoff is added to avoid thundering-herd effects. Context
// cancellation is respected during backoff waits.
func (c *Client) do(req *http.Request, target any) error {
	backoff := initialBackoff
	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		// On retry, rewind the request body for POST requests.
		if attempt > 0 {
			if req.GetBody != nil {
				newBody, err := req.GetBody()
				if err != nil {
					return fmt.Errorf("cheki: failed to rewind request body: %w", err)
				}
				req.Body = newBody
			}

			// Wait with exponential backoff + jitter, respecting context cancellation.
			jitter := time.Duration(rand.Int63n(int64(backoff) / 2))
			wait := backoff/2 + jitter
			select {
			case <-req.Context().Done():
				return req.Context().Err()
			case <-time.After(wait):
			}

			// Increase backoff for next iteration, capped at maxBackoff.
			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			// Network-level errors are not retryable (spec: 429/5xx only).
			return fmt.Errorf("cheki: request failed: %w", err)
		}

		raw, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			return fmt.Errorf("cheki: failed to read response: %w", readErr)
		}

		// Retry on 429 or 5xx if we haven't exhausted retries.
		if (resp.StatusCode == 429 || resp.StatusCode >= 500) && attempt < maxRetries {
			lastErr = &APIError{
				StatusCode: resp.StatusCode,
				Body:       string(raw),
				Message:    fmt.Sprintf("cheki: API returned status %d (retrying)", resp.StatusCode),
			}
			continue
		}

		// Non-retryable error or retries exhausted.
		if resp.StatusCode >= 400 {
			return &APIError{
				StatusCode: resp.StatusCode,
				Body:       string(raw),
				Message:    fmt.Sprintf("cheki: API returned status %d", resp.StatusCode),
			}
		}

		if err := json.Unmarshal(raw, target); err != nil {
			return fmt.Errorf("cheki: failed to decode response: %w", err)
		}
		return nil
	}

	// All retries exhausted - return the last API error.
	return lastErr
}

// APIError represents a non-2xx API response.
type APIError struct {
	StatusCode int
	Body       string
	Message    string
}

// Error implements the error interface.
func (e *APIError) Error() string {
	if e.Message == "" {
		return fmt.Sprintf("cheki: API error (status %d): %s", e.StatusCode, e.Body)
	}
	return e.Message
}
