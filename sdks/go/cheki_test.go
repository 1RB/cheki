package cheki

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type fixtureCase struct {
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers"`
	Body    json.RawMessage   `json:"body"`
}

type receiptURLCase struct {
	Name      string            `json:"name"`
	Bank      string            `json:"bank"`
	Reference string            `json:"reference"`
	Account   string            `json:"account"`
	Query     map[string]string `json:"query"`
	Error     bool              `json:"error"`
}

type retryCase struct {
	Name    string            `json:"name"`
	Method  string            `json:"method"`
	Path    string            `json:"path"`
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers"`
	Body    json.RawMessage   `json:"body"`
	RawBody *string           `json:"rawBody"`
	Retried bool              `json:"retried"`
}

type contract struct {
	Limits          map[string]json.RawMessage `json:"limits"`
	Cases           map[string]fixtureCase     `json:"cases"`
	ReceiptURLCases []receiptURLCase           `json:"receiptUrlCases"`
	RetryCases      []retryCase                `json:"retryCases"`
}

func loadContract(t *testing.T) contract {
	t.Helper()
	raw, err := os.ReadFile("../fixtures/api-contract.json")
	if err != nil {
		t.Fatalf("read fixtures: %v", err)
	}
	var c contract
	if err := json.Unmarshal(raw, &c); err != nil {
		t.Fatalf("decode fixtures: %v", err)
	}
	return c
}

// serve answers with the given cases in order (the last one repeats).
func serve(t *testing.T, cases ...fixtureCase) (*Client, *int32) {
	t.Helper()
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := int(atomic.AddInt32(&calls, 1))
		c := cases[min(n-1, len(cases)-1)]
		for k, v := range c.Headers {
			w.Header().Set(k, v)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(c.Status)
		_, _ = w.Write(c.Body)
	}))
	t.Cleanup(srv.Close)
	return NewClient(WithBaseURL(srv.URL)), &calls
}

func withRetryAfter(c fixtureCase, v string) fixtureCase {
	h := map[string]string{}
	for k, val := range c.Headers {
		// The fixture spells it "retry-after"; keeping both spellings made the
		// value depend on map iteration order (a flaky 17 s wait).
		if !strings.EqualFold(k, "Retry-After") {
			h[k] = val
		}
	}
	h["Retry-After"] = v
	c.Headers = h
	return c
}

func TestDefaults(t *testing.T) {
	c := loadContract(t)
	var timeoutSec, serverSec, batchMax int
	_ = json.Unmarshal(c.Limits["sdkTimeoutSeconds"], &timeoutSec)
	_ = json.Unmarshal(c.Limits["serverMaxDurationSeconds"], &serverSec)
	_ = json.Unmarshal(c.Limits["batchMaxReceipts"], &batchMax)
	if DefaultTimeout != time.Duration(timeoutSec)*time.Second || timeoutSec <= serverSec {
		t.Fatalf("DefaultTimeout %v must equal fixture %ds and exceed %ds", DefaultTimeout, timeoutSec, serverSec)
	}
	if MaxBatchSize != batchMax || MaxRetries != 1 {
		t.Fatalf("MaxBatchSize %d (want %d), MaxRetries %d (want 1)", MaxBatchSize, batchMax, MaxRetries)
	}
}

func TestVerifyVerified(t *testing.T) {
	c := loadContract(t)
	client, _ := serve(t, c.Cases["verify_verified"])
	r, err := client.Verify(context.Background(), VerifyOptions{Bank: "cbe", Reference: "FT26140P01YB", AccountNumber: "1000560536171"})
	if err != nil {
		t.Fatal(err)
	}
	if !r.IsVerified() || r.Amount != 1250.5 || r.BankCode != "cbe" || r.Cached {
		t.Fatalf("unexpected result %+v", r)
	}
}

func TestVerifyDecodedOnlyIsNotVerified(t *testing.T) {
	c := loadContract(t)
	client, _ := serve(t, c.Cases["verify_decoded_only"])
	r, err := client.Verify(context.Background(), VerifyOptions{Bank: "boa", QRData: "abc"})
	if err != nil {
		t.Fatal(err)
	}
	if !r.Success || !r.DecodedOnly || r.IsVerified() {
		t.Fatalf("decodedOnly must be success but not verified: %+v", r)
	}
}

func TestParseFixtureIsNotVerified(t *testing.T) {
	c := loadContract(t)
	var r VerifyResult
	if err := json.Unmarshal(c.Cases["parse_client_supplied"].Body, &r); err != nil {
		t.Fatal(err)
	}
	if !r.Parsed || r.IsVerified() {
		t.Fatalf("parsed must not be verified: %+v", r)
	}
}

func TestVerifyBatch(t *testing.T) {
	c := loadContract(t)
	client, _ := serve(t, c.Cases["batch_mixed"])
	b, err := client.VerifyBatch(context.Background(), []VerifyOptions{
		{Bank: "cbe", Reference: "A1", AccountNumber: "1000560536171"},
		{Bank: "boa", QRData: "q"},
		{Bank: "telebirr", Reference: "B2"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if b.Total != 3 || b.Verified != 1 || b.Failed != 2 || b.Cached != 0 || len(b.Results) != 3 {
		t.Fatalf("counts %+v", b)
	}
	if !b.Results[0].IsVerified() || b.Results[1].IsVerified() || !b.Results[1].DecodedOnly {
		t.Fatalf("items %+v", b.Results)
	}
	if b.Results[2].Success || b.Results[2].Status != 422 || b.Results[2].Error == "" || b.Results[2].Index != 2 {
		t.Fatalf("error item %+v", b.Results[2])
	}
}

func TestVerifyBatchTooLarge(t *testing.T) {
	c := loadContract(t)
	client, calls := serve(t, c.Cases["batch_mixed"])
	receipts := make([]VerifyOptions, 21)
	for i := range receipts {
		receipts[i] = VerifyOptions{Bank: "telebirr", Reference: "R"}
	}
	if _, err := client.VerifyBatch(context.Background(), receipts); !errors.Is(err, ErrBatchTooLarge) {
		t.Fatalf("want ErrBatchTooLarge, got %v", err)
	}
	if *calls != 0 {
		t.Fatalf("no request expected, got %d", *calls)
	}
}

func TestGetBanks(t *testing.T) {
	c := loadContract(t)
	client, _ := serve(t, c.Cases["banks"])
	banks, err := client.GetBanks(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if banks[0].ID != "cbe" || banks[0].Code != "cbe" || banks[0].AccountDigits != 8 || banks[0].RequiresPhone {
		t.Fatalf("bank %+v", banks[0])
	}
	if banks[1].Type != "mobile" || !banks[2].RequiresPhone || banks[3].Status != "in-development" {
		t.Fatalf("banks %+v", banks)
	}
	// Formats come current first: CBE leads with the Receipt ID; the FT reference is legacy.
	f := banks[0].Formats
	if banks[0].RequiresAccount || len(f) != 2 || f[0].Status != "current" || f[0].Inputs[0] != "receiptId" || f[1].Status != "legacy" || f[1].AccountDigits != 8 || !f[1].Supported {
		t.Fatalf("cbe formats %+v", f)
	}
}

func TestGetHealth(t *testing.T) {
	c := loadContract(t)
	client, _ := serve(t, c.Cases["health"])
	h, err := client.GetHealth(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if h.Status != "ok" || h.CheckedAt == "" || h.Cached || len(h.Banks) != 3 || h.Banks[1].Status != "geo-blocked" {
		t.Fatalf("health %+v", h)
	}
}

func TestClientErrorsAreNotRetried(t *testing.T) {
	c := loadContract(t)
	for _, name := range []string{"error_400_missing_input", "error_404_unsupported_bank", "error_422_not_found", "error_413_body_too_large"} {
		client, calls := serve(t, c.Cases[name])
		_, err := client.Verify(context.Background(), VerifyOptions{Bank: "cbe", Reference: "X"})
		var apiErr *APIError
		if !errors.As(err, &apiErr) || apiErr.StatusCode != c.Cases[name].Status || apiErr.Message == "" {
			t.Fatalf("%s: got %v", name, err)
		}
		if !strings.Contains(err.Error(), apiErr.Message) {
			t.Fatalf("%s: server message missing from %q", name, err.Error())
		}
		if *calls != 1 {
			t.Fatalf("%s: %d calls, want 1", name, *calls)
		}
	}
	client, _ := serve(t, c.Cases["error_413_body_too_large"])
	_, err := client.Verify(context.Background(), VerifyOptions{Bank: "cbe", Reference: "X"})
	if !errors.Is(err, ErrPayloadTooLarge) {
		t.Fatalf("413 should match ErrPayloadTooLarge: %v", err)
	}
}

func TestRateLimitRetriedOnceThenTyped(t *testing.T) {
	c := loadContract(t)
	client, calls := serve(t, withRetryAfter(c.Cases["error_429_rate_limited"], "0"))
	_, err := client.Verify(context.Background(), VerifyOptions{Bank: "cbe", Reference: "X"})
	var apiErr *APIError
	if !errors.Is(err, ErrRateLimited) || !errors.As(err, &apiErr) || !apiErr.IsRateLimited() || apiErr.RetryAfter != 0 {
		t.Fatalf("want rate-limit error, got %v", err)
	}
	if *calls != 2 {
		t.Fatalf("%d calls, want 2", *calls)
	}

	client, calls = serve(t, withRetryAfter(c.Cases["error_429_rate_limited"], "0"), c.Cases["verify_verified"])
	r, err := client.Verify(context.Background(), VerifyOptions{Bank: "cbe", Reference: "X"})
	if err != nil || !r.IsVerified() || *calls != 2 {
		t.Fatalf("retry after 429 should succeed: %v, calls %d", err, *calls)
	}
}

func TestLongRetryAfterIsNotWaited(t *testing.T) {
	c := loadContract(t)
	client, calls := serve(t, withRetryAfter(c.Cases["error_429_rate_limited"], "120"))
	_, err := client.Verify(context.Background(), VerifyOptions{Bank: "cbe", Reference: "X"})
	var apiErr *APIError
	if !errors.As(err, &apiErr) || apiErr.RetryAfter != 120*time.Second || *calls != 1 {
		t.Fatalf("got %v after %d calls", err, *calls)
	}
}

func TestGeoBlocked502NotRetried(t *testing.T) {
	c := loadContract(t)
	client, calls := serve(t, withRetryAfter(c.Cases["error_502_geo_blocked"], "0"))
	_, err := client.Verify(context.Background(), VerifyOptions{Bank: "telebirr", Reference: "CHQ0FJ403O"})
	var apiErr *APIError
	if !errors.As(err, &apiErr) || !strings.HasPrefix(apiErr.FallbackURL, "https://transactioninfo") {
		t.Fatalf("got %v", err)
	}
	if *calls != 1 {
		t.Fatalf("%d calls, want 1", *calls)
	}
}

// TestSharedRetryCases runs the retry rule every cheki SDK shares
// (retryCases in sdks/fixtures/api-contract.json).
func TestSharedRetryCases(t *testing.T) {
	c := loadContract(t)
	if len(c.RetryCases) < 10 {
		t.Fatalf("expected the shared retryCases, got %d", len(c.RetryCases))
	}
	for _, rc := range c.RetryCases {
		rc := rc
		t.Run(rc.Name, func(t *testing.T) {
			var calls int32
			var method atomic.Value
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				atomic.AddInt32(&calls, 1)
				method.Store(r.Method)
				for k, v := range rc.Headers {
					w.Header().Set(k, v)
				}
				w.WriteHeader(rc.Status)
				if rc.RawBody != nil {
					_, _ = w.Write([]byte(*rc.RawBody))
				} else {
					_, _ = w.Write(rc.Body)
				}
			}))
			defer srv.Close()
			client := NewClient(WithBaseURL(srv.URL))
			ctx := context.Background()
			var err error
			switch rc.Path {
			case "/api/verify":
				_, err = client.Verify(ctx, VerifyOptions{Bank: "telebirr", Reference: "CHQ0FJ403O"})
			case "/api/verify/batch":
				_, err = client.VerifyBatch(ctx, []VerifyOptions{{Bank: "telebirr", Reference: "CHQ0FJ403O"}})
			case "/api/banks":
				_, err = client.GetBanks(ctx)
			default:
				_, err = client.GetHealth(ctx)
			}
			var apiErr *APIError
			if !errors.As(err, &apiErr) || apiErr.StatusCode != rc.Status {
				t.Fatalf("want *APIError %d, got %v", rc.Status, err)
			}
			if m, _ := method.Load().(string); m != rc.Method {
				t.Fatalf("method %s, want %s", m, rc.Method)
			}
			want := int32(1)
			if rc.Retried {
				want = 2
			}
			if got := atomic.LoadInt32(&calls); got != want {
				t.Fatalf("%d calls, want %d", got, want)
			}
		})
	}
}

// brokenServer closes every connection without answering (a network error).
func brokenServer(t *testing.T) (string, *int32) {
	t.Helper()
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		hj, ok := w.(http.Hijacker)
		if !ok {
			t.Fatal("no hijacker")
		}
		conn, _, _ := hj.Hijack()
		_ = conn.Close()
	}))
	t.Cleanup(srv.Close)
	return srv.URL, &calls
}

func TestNetworkErrors(t *testing.T) {
	u, calls := brokenServer(t)
	client := NewClient(WithBaseURL(u))
	if _, err := client.GetBanks(context.Background()); err == nil || atomic.LoadInt32(calls) != 2 {
		t.Fatalf("GET: err %v, %d calls (want 2)", err, *calls)
	}
	atomic.StoreInt32(calls, 0)
	if _, err := client.Verify(context.Background(), VerifyOptions{Bank: "cbe", Reference: "X"}); err == nil || atomic.LoadInt32(calls) != 2 {
		t.Fatalf("verify: err %v, %d calls (want 2)", err, *calls)
	}
	atomic.StoreInt32(calls, 0)
	if _, err := client.VerifyBatch(context.Background(), []VerifyOptions{{Bank: "cbe", Reference: "X"}}); err == nil || atomic.LoadInt32(calls) != 1 {
		t.Fatalf("batch must not be replayed: err %v, %d calls (want 1)", err, *calls)
	}
}

func TestMaxRetriesClamped(t *testing.T) {
	c := loadContract(t)
	client, calls := serve(t, withRetryAfter(c.Cases["error_500_internal"], "0"))
	client = NewClient(WithBaseURL(client.baseURL), WithMaxRetries(5))
	_, _ = client.GetHealth(context.Background())
	if *calls != 2 {
		t.Fatalf("%d calls, want 2", *calls)
	}
	client = NewClient(WithBaseURL(client.baseURL), WithMaxRetries(0))
	*calls = 0
	_, _ = client.GetHealth(context.Background())
	if *calls != 1 {
		t.Fatalf("%d calls, want 1", *calls)
	}
}

func TestOrderIDBetaAndBatchFallback(t *testing.T) {
	c := loadContract(t)
	client, _ := serve(t, c.Cases["verify_order_id"])
	r, err := client.Verify(context.Background(), VerifyOptions{Bank: "cbebirr", Reference: "DTS41AB2C90", PhoneNumber: "0911004321"})
	if err != nil || r.OrderID != "FT26SAMPLE01" {
		t.Fatalf("orderId: %v %+v", err, r)
	}
	client, _ = serve(t, c.Cases["banks"])
	banks, err := client.GetBanks(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	beta := map[string]bool{}
	for _, b := range banks {
		beta[b.ID] = b.Beta
	}
	if !beta["zamzam"] || !beta["mpesa"] || beta["cbe"] {
		t.Fatalf("beta %+v", beta)
	}
	client, _ = serve(t, fixtureCase{Status: 200, Body: json.RawMessage(`{"success":true,"results":[{"success":false,"error":"geo","status":502,"fallbackUrl":"https://x.test/r"}],"total":1,"verified":0,"failed":1,"cached":0}`)})
	b, err := client.VerifyBatch(context.Background(), []VerifyOptions{{Bank: "telebirr", Reference: "A1"}})
	if err != nil || b.Results[0].FallbackURL != "https://x.test/r" {
		t.Fatalf("batch fallback: %v %+v", err, b)
	}
	if RecommendedBatchChunk > MaxBatchSize {
		t.Fatal("RecommendedBatchChunk above MaxBatchSize")
	}
}

func TestTimeoutNotRetried(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		select {
		case <-r.Context().Done():
		case <-time.After(500 * time.Millisecond):
		}
	}))
	defer srv.Close()
	client := NewClient(WithBaseURL(srv.URL), WithTimeout(50*time.Millisecond))
	_, err := client.Verify(context.Background(), VerifyOptions{Bank: "cbe", Reference: "X"})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("want timeout, got %v", err)
	}
	if atomic.LoadInt32(&calls) != 1 {
		t.Fatalf("%d calls, want 1", calls)
	}
}

func TestWithTimeoutDoesNotDropCustomClient(t *testing.T) {
	hc := &http.Client{}
	c := NewClient(WithHTTPClient(hc), WithTimeout(time.Second))
	if c.httpClient != hc || c.timeout != time.Second {
		t.Fatal("WithTimeout must keep a custom http.Client")
	}
	c = NewClient(WithTimeout(time.Second), WithHTTPClient(hc))
	if c.httpClient != hc || c.timeout != time.Second {
		t.Fatal("option order must not matter")
	}
}

func TestGetReceiptURL(t *testing.T) {
	c := NewClient(WithBaseURL("https://api.test"))
	cases := loadContract(t).ReceiptURLCases
	if len(cases) < 6 {
		t.Fatalf("receiptUrlCases missing: %d", len(cases))
	}
	for _, tc := range cases {
		u, err := c.GetReceiptURL(tc.Bank, tc.Reference, tc.Account)
		if tc.Error {
			if !errors.Is(err, ErrInvalidInput) {
				t.Fatalf("%s: want ErrInvalidInput, got %q %v", tc.Name, u, err)
			}
			continue
		}
		if err != nil {
			t.Fatalf("%s: %v", tc.Name, err)
		}
		parsed, perr := url.Parse(u)
		if perr != nil || parsed.Scheme+"://"+parsed.Host+parsed.Path != "https://api.test/api/receipt" {
			t.Fatalf("%s: url %q", tc.Name, u)
		}
		got := map[string]string{}
		for k, v := range parsed.Query() {
			got[k] = v[0]
		}
		if len(got) != len(tc.Query) {
			t.Fatalf("%s: query %v, want %v", tc.Name, got, tc.Query)
		}
		for k, v := range tc.Query {
			if got[k] != v {
				t.Fatalf("%s: query %v, want %v", tc.Name, got, tc.Query)
			}
		}
	}
}

func TestVerifyNeedsReferenceOrQR(t *testing.T) {
	c := NewClient()
	if _, err := c.Verify(context.Background(), VerifyOptions{Bank: "cbe"}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("got %v", err)
	}
}

func TestParseRetryAfter(t *testing.T) {
	now := time.Date(2026, 10, 11, 9, 0, 0, 0, time.UTC)
	if d := parseRetryAfter("17", now); d != 17*time.Second {
		t.Fatal(d)
	}
	if d := parseRetryAfter(now.Add(5*time.Second).Format(http.TimeFormat), now); d != 5*time.Second {
		t.Fatal(d)
	}
	if d := parseRetryAfter("soon", now); d != -1 {
		t.Fatal(d)
	}
}
