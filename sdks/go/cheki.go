// Package cheki provides a Go client for the cheki receipt verification API.
//
// cheki is a free Ethiopian receipt verification service available at
// https://cheki-pi.vercel.app. This client wraps the REST API, offering
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
	"net/http"
	"time"
)

// DefaultBaseURL is the default cheki API endpoint.
const DefaultBaseURL = "https://cheki-pi.vercel.app"

// DefaultTimeout is the default HTTP request timeout.
const DefaultTimeout = 30 * time.Second

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
func (c *Client) do(req *http.Request, target any) error {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("cheki: request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("cheki: failed to read response: %w", err)
	}

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
