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
type VerifyResult struct {
	Success      bool    `json:"success"`
	Verified     bool    `json:"verified"`
	Bank         string  `json:"bank"`
	Reference    string  `json:"reference"`
	SenderName   string  `json:"senderName"`
	ReceiverName string  `json:"receiverName"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	Date         string  `json:"date"`
	SourceURL    string  `json:"sourceUrl"`
	Error        string  `json:"error,omitempty"`
}

// BankInfo describes a bank supported by the cheki service.
type BankInfo struct {
	Code            string `json:"code"`
	Name            string `json:"name"`
	Status          string `json:"status"`
	RequiresAccount bool   `json:"requiresAccount"`
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
