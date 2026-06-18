"""Bank/wallet specific verifiers."""

from ethio_receipt_verify.banks.base import BankVerifier
from ethio_receipt_verify.banks.cbe import CBEVerifier
from ethio_receipt_verify.banks.telebirr import TelebirrVerifier
from ethio_receipt_verify.banks.boa import BOAVerifier
from ethio_receipt_verify.banks.mpesa import MPesaVerifier
from ethio_receipt_verify.banks.zemen import ZemenVerifier
from ethio_receipt_verify.banks.dashen import DashenVerifier
from ethio_receipt_verify.banks.awash import AwashVerifier
from ethio_receipt_verify.banks.cbebirr import CBEBirrVerifier
from ethio_receipt_verify.banks.siinqee import SiinqeeVerifier
from ethio_receipt_verify.banks.kaafiebirr import KaafiEbirrbankVerifier

VERIFIERS: dict[str, type[BankVerifier]] = {
    "cbe": CBEVerifier,
    "telebirr": TelebirrVerifier,
    "boa": BOAVerifier,
    "mpesa": MPesaVerifier,
    "zemen": ZemenVerifier,
    "dashen": DashenVerifier,
    "awash": AwashVerifier,
    "cbebirr": CBEBirrVerifier,
    "siinqee": SiinqeeVerifier,
    "kaafiebirr": KaafiEbirrbankVerifier,
}

__all__ = ["VERIFIERS", "BankVerifier"]
