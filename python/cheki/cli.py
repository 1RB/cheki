"""Command-line interface: ``cheki-verify`` (installed by ``pip install cheki``).

Uses the hosted cheki REST API by default. ``--direct`` runs the deprecated
direct verifiers on your own machine instead.

Exit codes: 0 only when the bank confirmed the receipt (``verified``),
1 when it did not or the request failed, 2 for usage errors.

Examples::

    cheki-verify cbe https://mbreciept.cbe.com.et/fHCxExampleRcpt01
    cheki-verify cbe FT26140P01YB --account 1000560536171   # older FT receipt (legacy)
    cheki-verify telebirr DET8FJGUJ4 --json
    cheki-verify boa --qr '<qr payload>'
    cheki-verify --health
    cheki-verify --list-banks

    # Deprecated: direct verification from this machine
    cheki-verify cbe FT26140P01YB --account 1000560536171 --direct
"""

from __future__ import annotations

import argparse
import json
import sys
import warnings
from typing import Any

from cheki import supported_banks, verify
from cheki.client import DEFAULT_BASE_URL, DEFAULT_TIMEOUT, ChekiClient
from cheki.client_types import (
    ChekiClientError,
    ClientVerifyResult,
)
from cheki.errors import VerificationError
from cheki.result import VerificationStatus


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cheki-verify",
        description=(
            "Free, open-source Ethiopian bank/wallet receipt verification "
            "through the hosted cheki API. Exits 0 only for a receipt the "
            "bank confirmed."
        ),
    )
    parser.add_argument("bank", nargs="?", help="Bank/wallet code (e.g. cbe, telebirr, boa, mpesa)")
    parser.add_argument("reference", nargs="?", help="Transaction reference number (optional with --qr)")
    parser.add_argument(
        "--account",
        dest="account_number",
        help="Receiving account number (required for cbe, boa)",
    )
    parser.add_argument(
        "--phone",
        dest="phone_number",
        help="Payer phone number (required for cbebirr)",
    )
    parser.add_argument(
        "--qr",
        dest="qr_data",
        help="Raw QR payload (supported for Bank of Abyssinia inter-bank receipts)",
    )
    parser.add_argument(
        "--api",
        action="store_true",
        help="Use the hosted cheki REST API (the default; kept for compatibility)",
    )
    parser.add_argument(
        "--direct",
        action="store_true",
        help="DEPRECATED: verify directly from this machine with the old Python parsers",
    )
    parser.add_argument(
        "--base-url",
        dest="base_url",
        default=DEFAULT_BASE_URL,
        help=f"cheki API base URL (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--api-key",
        dest="api_key",
        default=None,
        help="Optional bearer token for the cheki API",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT,
        help=f"Per-attempt timeout in seconds (default: {DEFAULT_TIMEOUT:g})",
    )
    parser.add_argument("--json", action="store_true", help="Output raw JSON instead of pretty text")
    parser.add_argument("--list-banks", action="store_true", help="List supported banks and exit")
    parser.add_argument("--health", action="store_true", help="Check cheki API health and exit")
    return parser


def _print_client_result(result: ClientVerifyResult, as_json: bool) -> int:
    if as_json:
        print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False, default=str))
        return 0 if result.is_verified else 1

    if not result.success:
        print(f"Verification failed: {result.error or 'unknown error'}", file=sys.stderr)
        if result.fallback_url:
            print(f"Fallback URL: {result.fallback_url}", file=sys.stderr)
        if result.is_rate_limited and result.retry_after is not None:
            print(f"Rate limited. Retry in {result.retry_after:g}s.", file=sys.stderr)
        return 1

    if not result.is_verified:
        if result.decoded_only:
            print("NOT VERIFIED: decoded from the QR code, the bank could not confirm it.")
        else:
            print("NOT VERIFIED")

    print(f"Bank:        {result.bank or ''}")
    print(f"Reference:   {result.reference or ''}")
    print(f"Verified:    {result.is_verified}")
    if result.amount is not None:
        print(f"Amount:      {result.amount} {result.currency or ''}")
    if result.sender_name:
        print(f"Sender:      {result.sender_name}")
    if result.receiver_name:
        print(f"Receiver:    {result.receiver_name}")
    if result.date:
        print(f"Date:        {result.date}")
    if result.source_url:
        print(f"Source:      {result.source_url}")
    if result.duration_ms is not None:
        print(f"Duration:    {result.duration_ms}ms")
    if result.reason:
        print(f"Reason:      {result.reason}")
    return 0 if result.is_verified else 1


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    # ── Service-level commands (API mode) ───────────────────────────
    if args.health:
        client = ChekiClient(
            base_url=args.base_url, api_key=args.api_key, timeout=args.timeout
        )
        try:
            health = client.get_health()
        except ChekiClientError as exc:
            print(f"Health check failed: {exc}", file=sys.stderr)
            return 1
        finally:
            client.close()
        if args.json:
            print(json.dumps(health.to_dict(), indent=2, ensure_ascii=False, default=str))
        else:
            print(f"Status:     {health.status}")
            if health.checked_at:
                print(f"Checked at: {health.checked_at}{' (cached)' if health.cached else ''}")
            for check in health.banks:
                latency = f" ({check.latency_ms}ms)" if check.latency_ms is not None else ""
                print(f"  {check.id or check.name:<12} {check.status}{latency}")
        return 0 if health.is_ok else 1

    if args.list_banks:
        if not args.direct:
            client = ChekiClient(
                base_url=args.base_url, api_key=args.api_key, timeout=args.timeout
            )
            try:
                banks = client.get_banks()
            except ChekiClientError as exc:
                print(f"Failed to list banks: {exc}", file=sys.stderr)
                return 1
            finally:
                client.close()
            if args.json:
                print(json.dumps([b.to_dict() for b in banks], indent=2, ensure_ascii=False))
            else:
                for b in banks:
                    status = b.status or "?"
                    suffix = ""
                    if b.requires_account:
                        suffix = f"  (requires account{f', {b.account_digits} digits' if b.account_digits else ''})"
                    elif b.requires_phone:
                        suffix = "  (requires phone)"
                    print(f"{b.id:<12} {b.name:<30} [{status}]{suffix}")
        else:
            for code, name in supported_banks().items():
                print(f"{code}: {name}")
        return 0

    # ── Verification commands ───────────────────────────────────────
    if not args.bank or not (args.reference or args.qr_data):
        parser.error("the following arguments are required: bank, and reference or --qr")

    if not args.direct:
        client = ChekiClient(
            base_url=args.base_url, api_key=args.api_key, timeout=args.timeout
        )
        try:
            result = client.verify(
                bank=args.bank,
                reference=args.reference or "",
                account_number=args.account_number,
                phone_number=args.phone_number,
                qr_data=args.qr_data,
            )
        except ChekiClientError as exc:
            print(f"Verification failed: {exc}", file=sys.stderr)
            return 1
        finally:
            client.close()
        return _print_client_result(result, args.json)

    # Direct verification (deprecated).
    print("warning: --direct is deprecated and will be removed; it lacks the server's verification gate.", file=sys.stderr)
    if not args.reference:
        parser.error("--direct needs a reference (QR codes need the API)")
    kwargs: dict[str, Any] = {}
    if args.account_number:
        kwargs["account_number"] = args.account_number
    if args.phone_number:
        kwargs["phone_number"] = args.phone_number

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            direct = verify(args.bank, args.reference, **kwargs)
    except VerificationError as exc:
        print(f"Verification failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001 - surface unexpected errors cleanly
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(direct.to_dict(), indent=2, ensure_ascii=False, default=str))
    else:
        print(f"Bank:        {direct.bank}")
        print(f"Reference:   {direct.reference}")
        print(f"Status:      {direct.status.value}")
        print(f"Exists:      {direct.exists}")
        if direct.amount is not None:
            print(f"Amount:      {direct.amount} {direct.currency}")
        if direct.sender_name:
            print(f"Sender:      {direct.sender_name}")
        if direct.receiver_name:
            print(f"Receiver:    {direct.receiver_name}")
        if direct.transaction_date:
            print(f"Date:        {direct.transaction_date}")
        if direct.source_url:
            print(f"Source:      {direct.source_url}")
        if direct.message:
            print(f"Message:     {direct.message}")
    return 0 if direct.status is VerificationStatus.VERIFIED else 1


if __name__ == "__main__":
    raise SystemExit(main())
