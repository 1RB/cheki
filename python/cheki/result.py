from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class VerificationStatus(Enum):
    VERIFIED = "verified"
    NOT_FOUND = "not_found"
    FAILED = "failed"
    UNAVAILABLE = "unavailable"
    UNSUPPORTED = "unsupported"


@dataclass
class VerificationResult:
    bank: str
    reference: str
    status: VerificationStatus
    exists: bool
    amount: float | None = None
    currency: str | None = "ETB"
    sender_name: str | None = None
    sender_account: str | None = None
    receiver_name: str | None = None
    receiver_account: str | None = None
    transaction_date: datetime | None = None
    raw: dict[str, Any] = field(default_factory=dict)
    source_url: str | None = None
    message: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "bank": self.bank,
            "reference": self.reference,
            "status": self.status.value,
            "exists": self.exists,
            "amount": self.amount,
            "currency": self.currency,
            "sender_name": self.sender_name,
            "sender_account": self.sender_account,
            "receiver_name": self.receiver_name,
            "receiver_account": self.receiver_account,
            "transaction_date": self.transaction_date.isoformat() if self.transaction_date else None,
            "source_url": self.source_url,
            "message": self.message,
            "raw": self.raw,
        }
