package cheki

// VerifyOptions is the input for a single receipt verification request.
//
// Bank is required, plus Reference or QRData. Lead with the bank's current
// format (a CBE receipt link or Receipt ID needs no account). AccountNumber is
// needed by BOA and by an older CBE receipt that shows only an FT reference
// (legacy format), PhoneNumber by CBE Birr (see BankInfo.Formats). QRData is a
// raw QR payload: a BOA QR code, a Telebirr receipt QR, or a receipt link from a
// QR (a CBE Birr receipt QR carries the receipt number and payer phone, so
// PhoneNumber is not needed).
type VerifyOptions struct {
	Bank          string `json:"bank"`
	Reference     string `json:"reference,omitempty"`
	AccountNumber string `json:"accountNumber,omitempty"`
	PhoneNumber   string `json:"phoneNumber,omitempty"`
	QRData        string `json:"qrData,omitempty"`
}

// VerifyResult is an HTTP 200 verification response.
//
// Success only means the request was processed. Verified is the only
// success signal; use IsVerified.
type VerifyResult struct {
	Success bool `json:"success"`
	// Verified is true only when the bank itself confirmed the receipt.
	Verified bool `json:"verified"`
	// DecodedOnly (BOA QR only): the QR was decrypted but BOA could not be
	// reached. Always paired with Verified false. A QR can be forged; never
	// treat this as proof of payment.
	DecodedOnly bool `json:"decodedOnly,omitempty"`
	// Parsed (/api/parse only): parsed from caller-supplied text, never checked.
	Parsed bool   `json:"parsed,omitempty"`
	Source string `json:"source,omitempty"`
	Label  string `json:"label,omitempty"`
	// Cached is true when the server answered from its receipt cache.
	Cached            bool    `json:"cached,omitempty"`
	Bank              string  `json:"bank,omitempty"`
	BankCode          string  `json:"bankCode,omitempty"`
	Reference         string  `json:"reference,omitempty"`
	SourceURL         string  `json:"sourceUrl,omitempty"`
	SenderName        string  `json:"senderName,omitempty"`
	SenderAccount     string  `json:"senderAccount,omitempty"`
	ReceiverName      string  `json:"receiverName,omitempty"`
	ReceiverAccount   string  `json:"receiverAccount,omitempty"`
	Amount            float64 `json:"amount,omitempty"`
	Currency          string  `json:"currency,omitempty"`
	Date              string  `json:"date,omitempty"`
	Branch            string  `json:"branch,omitempty"`
	Reason            string  `json:"reason,omitempty"`
	TransactionType   string  `json:"transactionType,omitempty"`
	DurationMs        int64   `json:"durationMs,omitempty"`
	InvoiceNumber     string  `json:"invoiceNumber,omitempty"`
	TransactionStatus string  `json:"transactionStatus,omitempty"`
	SettledAmount     float64 `json:"settledAmount,omitempty"`
	StampDuty         float64 `json:"stampDuty,omitempty"`
	DiscountAmount    float64 `json:"discountAmount,omitempty"`
	ServiceFee        float64 `json:"serviceFee,omitempty"`
	ServiceFeeVat     float64 `json:"serviceFeeVat,omitempty"`
	TotalPaid         float64 `json:"totalPaid,omitempty"`
	AmountInWords     string  `json:"amountInWords,omitempty"`
	PaymentMode       string  `json:"paymentMode,omitempty"`
	PaymentChannel    string  `json:"paymentChannel,omitempty"`
	BankAccountNumber string  `json:"bankAccountNumber,omitempty"`
	BankAccountName   string  `json:"bankAccountName,omitempty"`
	// OrderID is the order ID printed on the receipt (CBE Birr).
	OrderID string `json:"orderId,omitempty"`
	// Error is set on failed batch items.
	Error string `json:"error,omitempty"`
	// FallbackURL is set on a failed batch item for a geo-blocked bank, when
	// the server sends it: open it in a browser in Ethiopia instead.
	FallbackURL string `json:"fallbackUrl,omitempty"`
}

// IsVerified reports whether the bank confirmed the receipt. Success,
// DecodedOnly and Parsed are not proof of payment.
func (r *VerifyResult) IsVerified() bool { return r != nil && r.Verified }

// BatchItem is one entry of BatchResult.Results. A failed item has Success
// false, Error set, and Status (the HTTP status a single verify would have
// returned).
type BatchItem struct {
	VerifyResult
	Status int `json:"status,omitempty"`
	// Index is the position in the input slice (set by the SDK).
	Index int `json:"-"`
}

// BatchResult is the response returned by the batch verify endpoint.
type BatchResult struct {
	Success bool        `json:"success"`
	Results []BatchItem `json:"results"`
	Total   int         `json:"total"`
	// Verified counts items with Verified true.
	Verified int `json:"verified"`
	// Failed counts everything else (errors and decoded-only QR results).
	Failed int `json:"failed"`
	// Cached counts items served from the server cache.
	Cached int `json:"cached"`
}

// BankInfo describes a bank supported by the cheki service.
type BankInfo struct {
	// ID is the bank id to pass as VerifyOptions.Bank (e.g. "cbe").
	ID string `json:"id"`
	// Code is a deprecated alias of ID, filled in by GetBanks.
	//
	// Deprecated: use ID.
	Code   string `json:"-"`
	Name   string `json:"name"`
	Swift  string `json:"swift,omitempty"`
	Type   string `json:"type"`   // "bank" | "mobile" | "wallet"
	Status string `json:"status"` // "live" | "in-development"
	// Beta is true for a live bank not yet confirmed with enough real
	// receipts (M-Pesa, ZamZam and CBE Birr today).
	Beta            bool `json:"beta,omitempty"`
	RequiresAccount bool `json:"requiresAccount"`
	AccountDigits   int  `json:"accountDigits,omitempty"`
	RequiresPhone   bool `json:"requiresPhone,omitempty"`
	// Endpoint is the URL template of the bank's current format (informational).
	Endpoint string `json:"endpoint,omitempty"`
	Color    string `json:"color,omitempty"`
	Initials string `json:"initials,omitempty"`
	// Formats lists the bank's receipt formats, current first. Lead with the
	// first Supported one; the rest are older receipts.
	Formats []ReceiptFormat `json:"formats,omitempty"`
}

// ReceiptFormat is one receipt format of a bank.
type ReceiptFormat struct {
	ID string `json:"id"`
	// Status is "current", "legacy" (still works) or "deprecated" (links are
	// only read for their reference).
	Status string `json:"status"`
	Label  string `json:"label"`
	// Inputs the format needs: "reference", "receiptId", "link", "account", "phone".
	Inputs        []string `json:"inputs"`
	AccountDigits int      `json:"accountDigits,omitempty"`
	ResponseType  string   `json:"responseType"`
	// Supported is false when cheki documents the format but can't check it yet.
	Supported bool `json:"supported"`
	// Confidence is "verified" (observed by cheki) or "inferred".
	Confidence string `json:"confidence"`
}

// BankHealth is one bank's reachability in the health response.
type BankHealth struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"` // reachable | unreachable | geo-blocked | no-parser | in-development
	LatencyMs int64  `json:"latencyMs"`
}

// HealthStatus is the response returned by the health endpoint.
type HealthStatus struct {
	Status    string       `json:"status"`
	CheckedAt string       `json:"checkedAt"`
	Cached    bool         `json:"cached"`
	Banks     []BankHealth `json:"banks"`
}

// BanksResponse is the response returned by the banks endpoint.
type BanksResponse struct {
	Banks []BankInfo `json:"banks"`
}
