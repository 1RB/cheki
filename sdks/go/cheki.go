// Package cheki provides a Go client for the cheki receipt verification API.
//
// cheki is a free Ethiopian receipt verification service available at
// https://cheki.et. This client wraps the REST API, offering typed
// responses, context-aware requests, and idiomatic Go error handling.
//
// Verified is the ONLY success signal. A 200 response can still be
// unverified: a BOA QR code that could not be confirmed with the bank comes
// back with Verified false and DecodedOnly true. Use VerifyResult.IsVerified.
//
// Example:
//
//	client := cheki.NewClient()
//	result, err := client.Verify(context.Background(), cheki.VerifyOptions{
//	    Bank:      "cbe",
//	    Reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01",
//	})
//	if err != nil {
//	    log.Fatal(err)
//	}
//	if result.IsVerified() {
//	    fmt.Println(result.Amount, result.SenderName)
//	}
package cheki

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Version is the SDK version sent in the User-Agent header.
const Version = "1.5.0"

// DefaultBaseURL is the default cheki API endpoint.
const DefaultBaseURL = "https://cheki.et"

// DefaultTimeout is the per-attempt timeout. The server gives a verification
// up to 60 s, so the client waits a little longer than that.
const DefaultTimeout = 65 * time.Second

// MaxRetries is the most retries the client makes on top of the first
// attempt, and only where a retry is safe (see Client). The server already
// tries each bank fetch up to 2 times.
const MaxRetries = 1

// MaxBatchSize is the most receipts VerifyBatch accepts.
const MaxBatchSize = 20

// RecommendedBatchChunk is the chunk size to use for long lists. A batch is
// never retried, so smaller chunks lose less work to a 504, and 15 leaves
// room in the per-IP verify budget (30 per minute) for single checks.
const RecommendedBatchChunk = 15

const batchPath = "/api/verify/batch"

const (
	maxRetryAfter  = 60 * time.Second
	retryBaseDelay = time.Second
)

// ReceiptDownloadBanks lists the banks /api/receipt serves, with the number
// of trailing account digits their legacy format needs (0 when none). For CBE
// only an older FT reference (legacyCBEReference) needs the account; the
// current format, a Receipt ID from a mbreciept.cbe.com.et link, needs none.
var ReceiptDownloadBanks = map[string]int{"cbe": 8, "zemen": 0, "dashen": 0, "zamzam": 0}

// receiptReferenceRules are stricter per-bank reference rules the server
// applies: a ZamZam receipt id is digits only.
var receiptReferenceRules = map[string]struct {
	pattern *regexp.Regexp
	hint    string
}{
	"zamzam": {regexp.MustCompile(`^[0-9]+$`), "a ZamZam receipt id is digits only (the number at the end of the receipt link)"},
}

// legacyCBEReference matches an older CBE FT reference (legacy format).
var legacyCBEReference = regexp.MustCompile(`(?i)^FT[A-Za-z0-9]{8,12}$`)

var safeReference = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`)

// Sentinel errors, usable with errors.Is.
var (
	// ErrRateLimited matches an *APIError with status 429.
	ErrRateLimited = errors.New("cheki: rate limited")
	// ErrPayloadTooLarge matches an *APIError with status 413.
	ErrPayloadTooLarge = errors.New("cheki: request body too large")
	// ErrBatchTooLarge is returned by VerifyBatch for more than MaxBatchSize receipts.
	ErrBatchTooLarge = fmt.Errorf("cheki: a batch accepts at most %d receipts", MaxBatchSize)
	// ErrInvalidInput is returned for input rejected before any request is made.
	ErrInvalidInput = errors.New("cheki: invalid input")
)

// Client is the cheki API client.
//
// Retries (at most one, the same in every cheki SDK):
//   - GET (GetBanks, GetHealth): network errors and 5xx.
//   - POST /api/verify: network errors, and 429/503 with a Retry-After of at
//     most 60 s. Never 500/502/504: the server already ran the check (a
//     geo-blocked bank answers 502 every time).
//   - POST /api/verify/batch: only 429/503 with a short Retry-After. A 504
//     means the batch ran out of time; replaying it would hit every bank
//     again and charge every receipt against the rate limit.
//   - Never: timeouts, a cancelled context, other 4xx, and any answer with
//     "retryable": false or a fallbackUrl.
type Client struct {
	baseURL    string
	httpClient *http.Client
	timeout    time.Duration
	maxRetries int
	userAgent  string
}

// Option configures a Client at construction time.
type Option func(*Client)

// WithBaseURL overrides the default API base URL.
func WithBaseURL(u string) Option {
	return func(c *Client) {
		if u != "" {
			c.baseURL = strings.TrimRight(u, "/")
		}
	}
}

// WithHTTPClient supplies a custom *http.Client. The per-attempt timeout
// (WithTimeout) still applies, through the request context.
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) {
		if hc != nil {
			c.httpClient = hc
		}
	}
}

// WithTimeout sets the per-attempt timeout. It works with or without
// WithHTTPClient, in any order. Zero or negative disables it (the context
// passed to each call still applies).
func WithTimeout(d time.Duration) Option {
	return func(c *Client) { c.timeout = d }
}

// WithMaxRetries sets the retries (only where safe, see Client). Values are
// clamped to 0..MaxRetries.
func WithMaxRetries(n int) Option {
	return func(c *Client) {
		if n < 0 {
			n = 0
		}
		if n > MaxRetries {
			n = MaxRetries
		}
		c.maxRetries = n
	}
}

// WithUserAgent overrides the User-Agent header.
func WithUserAgent(ua string) Option {
	return func(c *Client) {
		if ua != "" {
			c.userAgent = ua
		}
	}
}

// NewClient creates a cheki API client with the given options.
func NewClient(opts ...Option) *Client {
	c := &Client{
		baseURL:    DefaultBaseURL,
		httpClient: &http.Client{},
		timeout:    DefaultTimeout,
		maxRetries: MaxRetries,
		userAgent:  "cheki-go-sdk/" + Version,
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Verify verifies a single receipt.
//
// It returns a result for HTTP 200, which includes unverified decoded-only
// BOA QR results: check IsVerified. Any other status is an *APIError
// (422 not found, 404 unsupported bank, 429 rate limited, ...).
func (c *Client) Verify(ctx context.Context, opts VerifyOptions) (*VerifyResult, error) {
	if strings.TrimSpace(opts.Bank) == "" {
		return nil, fmt.Errorf("%w: bank is required", ErrInvalidInput)
	}
	if strings.TrimSpace(opts.Reference) == "" && strings.TrimSpace(opts.QRData) == "" {
		return nil, fmt.Errorf("%w: reference or QRData is required", ErrInvalidInput)
	}
	body, err := json.Marshal(opts)
	if err != nil {
		return nil, fmt.Errorf("cheki: failed to marshal request: %w", err)
	}
	var result VerifyResult
	if err := c.do(ctx, http.MethodPost, "/api/verify", body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// VerifyBatch verifies up to MaxBatchSize receipts in one request. Every
// item also counts against the per-IP verify limit (30 per minute). A batch
// is never replayed on a 5xx or network error; split long lists into chunks
// of RecommendedBatchChunk or fewer.
func (c *Client) VerifyBatch(ctx context.Context, receipts []VerifyOptions) (*BatchResult, error) {
	if len(receipts) == 0 {
		return nil, fmt.Errorf("%w: at least one receipt is required", ErrInvalidInput)
	}
	if len(receipts) > MaxBatchSize {
		return nil, fmt.Errorf("%w (got %d); split the list into chunks of %d", ErrBatchTooLarge, len(receipts), MaxBatchSize)
	}
	body, err := json.Marshal(struct {
		Receipts []VerifyOptions `json:"receipts"`
	}{Receipts: receipts})
	if err != nil {
		return nil, fmt.Errorf("cheki: failed to marshal request: %w", err)
	}
	var result BatchResult
	if err := c.do(ctx, http.MethodPost, batchPath, body, &result); err != nil {
		return nil, err
	}
	for i := range result.Results {
		result.Results[i].Index = i
	}
	return &result, nil
}

// GetBanks retrieves the list of supported banks. BankInfo.ID is the value
// to pass as VerifyOptions.Bank.
func (c *Client) GetBanks(ctx context.Context) ([]BankInfo, error) {
	var resp BanksResponse
	if err := c.do(ctx, http.MethodGet, "/api/banks", nil, &resp); err != nil {
		return nil, err
	}
	for i := range resp.Banks {
		resp.Banks[i].Code = resp.Banks[i].ID
	}
	return resp.Banks, nil
}

// GetHealth retrieves per-bank reachability. The server caches it for up to
// 5 minutes.
func (c *Client) GetHealth(ctx context.Context) (*HealthStatus, error) {
	var status HealthStatus
	if err := c.do(ctx, http.MethodGet, "/api/health", nil, &status); err != nil {
		return nil, err
	}
	return &status, nil
}

// GetReceiptURL returns the URL of GET /api/receipt, which opens the bank's
// own copy of a receipt. Supported: CBE, Dashen, Zemen and ZamZam. Lead with
// the current format: a CBE Receipt ID, a Dashen FT Ref or a ZamZam receipt
// id (digits only), which the server answers with a redirect to the bank's own receipt page. An older CBE FT
// reference (legacy) also needs the receiving account (at least its last 8
// digits) and comes back as the bank's PDF. No request is made.
func (c *Client) GetReceiptURL(bank, reference, accountNumber string) (string, error) {
	id := strings.ToLower(strings.TrimSpace(bank))
	digits, ok := ReceiptDownloadBanks[id]
	if !ok {
		return "", fmt.Errorf("%w: receipt download is only supported for cbe, zemen, dashen and zamzam", ErrInvalidInput)
	}
	ref := strings.TrimSpace(reference)
	if !safeReference.MatchString(ref) || strings.Contains(ref, "..") {
		return "", fmt.Errorf("%w: reference must be 1-64 letters, digits, dots, dashes or underscores", ErrInvalidInput)
	}
	if rule, ok := receiptReferenceRules[id]; ok && !rule.pattern.MatchString(ref) {
		return "", fmt.Errorf("%w: %s", ErrInvalidInput, rule.hint)
	}
	q := url.Values{}
	q.Set("bank", id)
	q.Set("reference", ref)
	if digits > 0 && (id != "cbe" || legacyCBEReference.MatchString(ref)) {
		acct := strings.NewReplacer(" ", "", "-", "").Replace(accountNumber)
		if len(acct) < digits || strings.Trim(acct, "0123456789") != "" {
			return "", fmt.Errorf("%w: an older %s FT reference needs the receiving account number (at least the last %d digits); a Receipt ID from the receipt link needs none", ErrInvalidInput, id, digits)
		}
		q.Set("account", acct)
	}
	return c.baseURL + "/api/receipt?" + q.Encode(), nil
}

// do performs the request with at most one retry, only where it is safe
// (see Client and shouldRetry).
func (c *Client) do(ctx context.Context, method, path string, body []byte, target any) error {
	for attempt := 0; ; attempt++ {
		canRetry := attempt < c.maxRetries
		status, raw, header, err := c.attempt(ctx, method, path, body)
		if err != nil {
			var te *timeoutError
			// A batch may have reached the server before the connection
			// broke; replaying it would run (and charge) every receipt again.
			if errors.As(err, &te) || ctx.Err() != nil || !canRetry || path == batchPath {
				return err
			}
			if werr := sleep(ctx, retryDelay(-1)); werr != nil {
				return werr
			}
			continue
		}

		if status >= 200 && status < 300 {
			if err := json.Unmarshal(raw, target); err != nil {
				return fmt.Errorf("cheki: failed to decode response: %w", err)
			}
			return nil
		}

		apiErr := newAPIError(method, path, status, raw, header)
		if canRetry && shouldRetry(method, apiErr) {
			if werr := sleep(ctx, retryDelay(apiErr.RetryAfter)); werr != nil {
				return werr
			}
			continue
		}
		return apiErr
	}
}

// shouldRetry is the retry rule shared by every cheki SDK (retryCases in
// sdks/fixtures/api-contract.json): never when the body says
// "retryable": false or carries a fallbackUrl; 429 and 503 only with a
// Retry-After of at most 60 s; any other 5xx only for GET.
func shouldRetry(method string, e *APIError) bool {
	if e.notRetryable || e.FallbackURL != "" {
		return false
	}
	switch {
	case e.StatusCode == http.StatusTooManyRequests || e.StatusCode == http.StatusServiceUnavailable:
		return e.RetryAfter >= 0 && e.RetryAfter <= maxRetryAfter
	case e.StatusCode >= 500 && method == http.MethodGet:
		return e.RetryAfter < 0 || e.RetryAfter <= maxRetryAfter
	}
	return false
}

type timeoutError struct {
	path    string
	timeout time.Duration
}

func (e *timeoutError) Error() string {
	return fmt.Sprintf("cheki: request to %s timed out after %s", e.path, e.timeout)
}

// Is makes errors.Is(err, context.DeadlineExceeded) true for timeouts.
func (e *timeoutError) Is(target error) bool { return target == context.DeadlineExceeded }

func (c *Client) attempt(ctx context.Context, method, path string, body []byte) (int, []byte, http.Header, error) {
	actx := ctx
	cancel := context.CancelFunc(func() {})
	if c.timeout > 0 {
		actx, cancel = context.WithTimeout(ctx, c.timeout)
	}
	defer cancel()

	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(actx, method, c.baseURL+path, reader)
	if err != nil {
		return 0, nil, nil, fmt.Errorf("cheki: failed to create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", c.userAgent)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err == nil {
		defer resp.Body.Close()
		raw, rerr := io.ReadAll(resp.Body)
		if rerr == nil {
			return resp.StatusCode, raw, resp.Header, nil
		}
		err = rerr
	}
	if ctx.Err() != nil {
		return 0, nil, nil, fmt.Errorf("cheki: request to %s cancelled: %w", path, ctx.Err())
	}
	if actx.Err() == context.DeadlineExceeded {
		return 0, nil, nil, &timeoutError{path: path, timeout: c.timeout}
	}
	return 0, nil, nil, fmt.Errorf("cheki: request to %s failed: %w", path, err)
}

// retryDelay is the Retry-After when given (>= 0), otherwise 1-2 s.
func retryDelay(retryAfter time.Duration) time.Duration {
	if retryAfter >= 0 {
		return retryAfter
	}
	return retryBaseDelay + time.Duration(rand.Int63n(int64(retryBaseDelay)))
}

func sleep(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return ctx.Err()
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

// parseRetryAfter returns the Retry-After delay, or -1 when absent or invalid.
func parseRetryAfter(v string, now time.Time) time.Duration {
	v = strings.TrimSpace(v)
	if v == "" {
		return -1
	}
	if n, err := strconv.Atoi(v); err == nil && n >= 0 {
		return time.Duration(n) * time.Second
	}
	if t, err := http.ParseTime(v); err == nil {
		d := t.Sub(now)
		if d < 0 {
			d = 0
		}
		return d.Round(time.Second)
	}
	return -1
}

// APIError is a non-2xx API response.
//
// Status codes: 400 bad input, 404 unsupported bank, 413 body too large,
// 422 receipt not found or not a valid receipt, 429 rate limited, 502 bank
// unreachable, 500 internal error. errors.Is(err, ErrRateLimited) and
// errors.Is(err, ErrPayloadTooLarge) work on it.
type APIError struct {
	StatusCode int
	Method     string
	Path       string
	// Message is the server's error text, when it sent one.
	Message string
	// FallbackURL is set for geo-blocked banks: open it in a browser in Ethiopia.
	FallbackURL string
	// CheckedURL is set on a 422: the bank page cheki asked, so you can see
	// the bank's own answer.
	CheckedURL string
	// RetryAfter is the server's Retry-After, or -1 when it sent none.
	RetryAfter time.Duration
	// Body is the raw response body.
	Body string

	// notRetryable is set when the body says "retryable": false.
	notRetryable bool
}

func newAPIError(method, path string, status int, raw []byte, header http.Header) *APIError {
	e := &APIError{
		StatusCode: status,
		Method:     method,
		Path:       path,
		Body:       string(raw),
		RetryAfter: parseRetryAfter(header.Get("Retry-After"), time.Now()),
	}
	var envelope struct {
		Error       string `json:"error"`
		FallbackURL string `json:"fallbackUrl"`
		CheckedURL  string `json:"checkedUrl"`
		Retryable   *bool  `json:"retryable"`
	}
	if json.Unmarshal(raw, &envelope) == nil {
		e.Message = envelope.Error
		e.FallbackURL = envelope.FallbackURL
		e.CheckedURL = envelope.CheckedURL
		e.notRetryable = envelope.Retryable != nil && !*envelope.Retryable
	}
	return e
}

// Error implements the error interface.
func (e *APIError) Error() string {
	s := fmt.Sprintf("cheki: API returned %d for %s %s", e.StatusCode, e.Method, e.Path)
	if e.Message != "" {
		s += ": " + e.Message
	}
	return s
}

// Is supports errors.Is(err, ErrRateLimited) and errors.Is(err, ErrPayloadTooLarge).
func (e *APIError) Is(target error) bool {
	switch target {
	case ErrRateLimited:
		return e.StatusCode == http.StatusTooManyRequests
	case ErrPayloadTooLarge:
		return e.StatusCode == http.StatusRequestEntityTooLarge
	}
	return false
}

// IsRateLimited reports a 429. RetryAfter says how long to wait (-1 if unknown).
func (e *APIError) IsRateLimited() bool { return e.StatusCode == http.StatusTooManyRequests }

// IsPayloadTooLarge reports a 413.
func (e *APIError) IsPayloadTooLarge() bool {
	return e.StatusCode == http.StatusRequestEntityTooLarge
}
