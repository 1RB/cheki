package cheki

// VerifyOptions is the input for a single receipt verification request.
//
// Bank and Reference are required. The remaining fields are optional and
// their necessity depends on the bank's requirements (see BankInfo.RequiresAccount).
type VerifyOptions struct {
	Bank          string `json:"bank"`
	Reference     string `json:"reference"`
	AccountNumber string `json:"accountNumber,omitempty"`
	PhoneNumber   string `json:"phoneNumber,omitempty"`
	QRData        string `json:"qrData,omitempty"`
}

// VerifyResult is the response returned by the verify endpoint.
//
// All fields except Success and Verified are optional; their presence depends
// on the bank and the specific transaction.
type VerifyResult struct {
	Success           bool    `json:"success"`
	Verified          bool    `json:"verified"`
	Bank              string  `json:"bank"`
	BankCode          string  `json:"bankCode,omitempty"`
	Reference         string  `json:"reference"`
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
	Error             string  `json:"error,omitempty"`
}

// BankInfo describes a bank supported by the cheki service.
type BankInfo struct {
	Code            string `json:"code"`
	Name            string `json:"name"`
	Status          string `json:"status"`   // "live" | "in-development"
	Type            string `json:"type"`     // "bank" | "wallet"
	RequiresAccount bool   `json:"requiresAccount"`
	AccountDigits   int    `json:"accountDigits,omitempty"`
	RequiresPhone   bool   `json:"requiresPhone"`
	ResponseType    string `json:"responseType,omitempty"`
	Endpoint        string `json:"endpoint,omitempty"`
	SslVerify       bool   `json:"sslVerify"`
	Notes           string `json:"notes,omitempty"`
	Color           string `json:"color,omitempty"`
	Initials        string `json:"initials,omitempty"`
}

// BatchResult is the response returned by the batch verify endpoint.
type BatchResult struct {
	Success  bool           `json:"success"`
	Total    int            `json:"total"`
	Verified int            `json:"verified"`
	Failed   int            `json:"failed"`
	Results  []VerifyResult `json:"results"`
}

// HealthCheck represents a single service health check entry.
type HealthCheck struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

// HealthStatus is the response returned by the health endpoint.
type HealthStatus struct {
	Success   bool          `json:"success"`
	Status    string        `json:"status"`
	Version   string        `json:"version"`
	Timestamp string        `json:"timestamp"`
	Checks    []HealthCheck `json:"checks"`
}

// BanksResponse is the response returned by the banks endpoint.
type BanksResponse struct {
	Success bool       `json:"success"`
	Count   int        `json:"count"`
	Banks   []BankInfo `json:"banks"`
}
