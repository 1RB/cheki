"""Bank/wallet specific verifiers."""

from cheki.banks.base import BankVerifier
from cheki.banks.cbe import CBEVerifier
from cheki.banks.telebirr import TelebirrVerifier
from cheki.banks.boa import BOAVerifier
from cheki.banks.mpesa import MPesaVerifier
from cheki.banks.zemen import ZemenVerifier
from cheki.banks.dashen import DashenVerifier
from cheki.banks.awash import AwashVerifier
from cheki.banks.cbebirr import CBEBirrVerifier
from cheki.banks.siinqee import SiinqeeVerifier
from cheki.banks.kaafiebirr import KaafiEbirrbankVerifier

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
