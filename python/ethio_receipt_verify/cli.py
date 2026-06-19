"""Command-line interface for ethio-receipt-verify.

Supports two verification modes:

* ``--api``    — use the hosted cheki REST API (default for new users).
* default     — direct verification, fetching bank endpoints locally
                (advanced; subject to geo-blocking).

Examples::

    # API client (recommended)
    ethio-verify cbe FT26140P01YB --account 1000560536171 --api
    ethio-verify telebirr DET8FJGUJ4 --api --json

    # Direct verification (advanced)
    ethio-verify cbe FT26140P01YB --account 1000560536171

    # Service health & supported banks (via API)
    ethio-verify --health
    ethio-verify --list-banks --api
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from ethio_receipt_verify import supported_banks, verify
from ethio_receipt_verify.client import DEFAULT_BASE_URL, ChekiClient
from ethio_receipt_verify.client_types import (
    ChekiClientError,
    ClientVerifyResult,
)
from ethio_receipt_verify.errors import VerificationError


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ethio-verify",
        description=(
            "Free, open-source Ethiopian bank/wallet receipt verification. "
            "Use --api for the hosted cheki service (recommended) or the "
            "default mode for direct endpoint verification (advanced)."
        ),
    )
    parser.add_argument("bank", nargs="?", help="Bank/wallet code (e.g. cbe, telebirr, boa, mpesa)")
    parser.add_argument("reference", nargs="?", help="Transaction reference number")
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
        help="Use the hosted cheki REST API instead of direct verification",
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
        default=30.0,
        help="Per-request timeout in seconds (API mode, default: 30)",
    )
    parser.add_argument("--json", action="store_true", help="Output raw JSON instead of pretty text")
    parser.add_argument("--list-banks", action="store_true", help="List supported banks and exit")
    parser.add_argument("--health", action="store_true", help="Check cheki API health and exit")
    return parser


def _print_client_result(result: ClientVerifyResult, as_json: bool) -> int:
    if as_json:
        print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False, default=str))
        return 0

    if not result.success:
        print(f"Verification failed: {result.error or 'unknown error'}", file=sys.stderr)
        if result.fallback_url:
            print(f"Fallback URL: {result.fallback_url}", file=sys.stderr)
        return 1

    print(f"Bank:        {result.bank or ''}")
    print(f"Reference:   {result.reference or ''}")
    print(f"Verified:    {result.verified}")
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
        if not args.api:
            print("--health requires --api (the cheki REST API).", file=sys.stderr)
            return 2
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
            if health.version:
                print(f"Version:    {health.version}")
            if health.timestamp:
                print(f"Timestamp:  {health.timestamp}")
            for check in health.checks:
                latency = f" ({check.latency_ms}ms)" if check.latency_ms is not None else ""
                print(f"  {check.name:<20} {check.status}{latency}")
        return 0 if health.is_ok else 1

    if args.list_banks:
        if args.api:
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
                    print(f"{b.code:<12} {b.name:<30} [{status}]{suffix}")
        else:
            for code, name in supported_banks().items():
                print(f"{code}: {name}")
        return 0

    # ── Verification commands ───────────────────────────────────────
    if not args.bank or not args.reference:
        if args.qr_data and args.bank:
            # QR-based verification may omit an explicit reference.
            pass
        else:
            parser.error("the following arguments are required: bank, reference")

    if args.api:
        client = ChekiClient(
            base_url=args.base_url, api_key=args.api_key, timeout=args.timeout
        )
        try:
            result = client.verify(
                bank=args.bank,
                reference=args.reference,
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

    # Direct verification (advanced).
    kwargs: dict[str, Any] = {}
    if args.account_number:
        kwargs["account_number"] = args.account_number
    if args.phone_number:
        kwargs["phone_number"] = args.phone_number

    try:
        result = verify(args.bank, args.reference, **kwargs)
    except VerificationError as exc:
        print(f"Verification failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001 - surface unexpected errors cleanly
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False, default=str))
    else:
        print(f"Bank:        {result.bank}")
        print(f"Reference:   {result.reference}")
        print(f"Status:      {result.status.value}")
        print(f"Exists:      {result.exists}")
        if result.amount is not None:
            print(f"Amount:      {result.amount} {result.currency}")
        if result.sender_name:
            print(f"Sender:      {result.sender_name}")
        if result.receiver_name:
            print(f"Receiver:    {result.receiver_name}")
        if result.transaction_date:
            print(f"Date:        {result.transaction_date}")
        if result.source_url:
            print(f"Source:      {result.source_url}")
        if result.message:
            print(f"Message:     {result.message}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
