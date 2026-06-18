"""Command-line interface for ethio-receipt-verify."""

import argparse
import json
import sys

from ethio_receipt_verify import supported_banks, verify
from ethio_receipt_verify.errors import VerificationError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="ethio-verify",
        description="Free, open-source Ethiopian bank/wallet receipt verification.",
    )
    parser.add_argument("bank", help="Bank/wallet code (e.g. cbe, telebirr, boa, mpesa)")
    parser.add_argument("reference", help="Transaction reference number")
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
        "--json", action="store_true", help="Output raw JSON instead of pretty text"
    )
    parser.add_argument(
        "--list-banks", action="store_true", help="List supported banks and exit"
    )

    args = parser.parse_args(argv)

    if args.list_banks:
        for code, name in supported_banks().items():
            print(f"{code}: {name}")
        return 0

    kwargs: dict = {}
    if args.account_number:
        kwargs["account_number"] = args.account_number
    if args.phone_number:
        kwargs["phone_number"] = args.phone_number

    try:
        result = verify(args.bank, args.reference, **kwargs)
    except VerificationError as exc:
        print(f"Verification failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
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
