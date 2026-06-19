from cheki.banks import VERIFIERS, BankVerifier
from cheki.result import VerificationResult


def supported_banks() -> dict[str, str]:
    return {
        code: cls.BANK_NAME
        for code, cls in VERIFIERS.items()
    }


def verify(bank: str, reference: str, **kwargs: object) -> VerificationResult:
    """Verify a receipt for the given bank.

    Args:
        bank: Bank/wallet code, e.g. "cbe", "telebirr", "boa", "mpesa".
        reference: Transaction reference number.
        **kwargs: Bank-specific extras:
            - cbe, boa: account_number (full receiving account)
            - cbebirr: phone_number (payer phone)
    """
    bank = bank.lower().strip()
    if bank not in VERIFIERS:
        raise ValueError(
            f"Unsupported bank '{bank}'. Supported: {', '.join(VERIFIERS)}"
        )
    verifier = VERIFIERS[bank]()
    return verifier.verify(reference, **kwargs)
