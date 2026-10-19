#!/usr/bin/env node
/**
 * cheki CLI - verify ethiopian receipts from the terminal.
 *
 * Usage:
 *   cheki info                                    List supported banks
 *   cheki verify cbe https://mbreciept.cbe.com.et/<id>  Verify a CBE receipt (Receipt ID link)
 *   cheki verify cbe FT26SAMPLE01 -a 1000000006171  Older CBE receipt (legacy FT reference)
 *   cheki verify telebirr CHQ0SAMPLE                 Verify a Telebirr receipt
 *   cheki verify boa AB12345 -a 1234567890           Verify a BOA receipt
 *   cheki health                                     Check endpoint health
 */
import { Verifier, getAllBanks, errorToMessage, type BankManifestEntry } from "../lib";
import { cliVerdict } from "./verdict";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(`cheki - verify ethiopian receipts for free

Usage:
  cheki info                                      List supported banks
  cheki verify <bank> <ref> [-a <account>]        Verify a receipt
  cheki verify-qr <bank> <qr-data>                Verify from QR code
  cheki health                                    Check endpoint health
  cheki --version                                 Show version

Examples:
  cheki verify cbe https://mbreciept.cbe.com.et/fHCxExampleRcpt01
  cheki verify dashen B22WDTI00SAMPLE1
  cheki verify telebirr CHQ0SAMPLE
  cheki verify boa AB12345 -a 1234567890
  cheki verify-qr boa <base64-qr-payload>
  cheki verify-qr telebirr <telebirr-receipt-qr>     (reads the transaction number, then checks it)
  cheki verify cbe FT26SAMPLE01 -a 1000000006171   (older CBE receipt, legacy format)
`);
    process.exit(0);
  }

  if (command === "--version" || command === "-v") {
    console.log("cheki v1.0.0");
    process.exit(0);
  }

  if (command === "info") {
    const banks = getAllBanks();
    console.log("\n  Supported banks:\n");
    for (const b of banks) {
      const status = b.status === "live" ? "OK" : "SOON";
      const legacy = (b.formats ?? []).find((f) => f.status === "legacy" && f.parser && f.inputs.some((i) => i.name === "account"));
      const acct = b.requiresAccount
        ? ` (requires ${b.accountDigits}-digit account)`
        : legacy
          ? ` (older receipts: ${legacy.label})`
          : "";
      console.log(`  ${status.padEnd(4)} ${b.id.padEnd(12)} ${b.name}${acct}`);
    }
    console.log(`\n  ${banks.length} banks total, ${banks.filter(b => b.status === "live").length} live\n`);
    process.exit(0);
  }

  if (command === "health") {
    const banks = getAllBanks();
    console.log("\n  Checking endpoints...\n");
    for (const b of banks) {
      if (b.status !== "live") {
        console.log(`  SKIP  ${b.id.padEnd(12)} ${b.name} (in development)`);
        continue;
      }
      const start = Date.now();
      try {
        const url = b.endpoint.replace("{ref}", "test").replace("{account}", "00000000").replace("{phone}", "0000000000");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        await fetch(url, { signal: controller.signal, headers: { "User-Agent": "cheki-health" } });
        clearTimeout(timeout);
        console.log(`  OK    ${b.id.padEnd(12)} ${b.name} (${Date.now() - start}ms)`);
      } catch {
        console.log(`  FAIL  ${b.id.padEnd(12)} ${b.name} (${Date.now() - start}ms)`);
      }
    }
    console.log("");
    process.exit(0);
  }

  if (command === "verify") {
    const bank = args[1];
    const reference = args[2];
    const accountIdx = args.indexOf("-a");
    const accountNumber = accountIdx > -1 ? args[accountIdx + 1] : undefined;
    const phoneIdx = args.indexOf("-p");
    const phoneNumber = phoneIdx > -1 ? args[phoneIdx + 1] : undefined;

    if (!bank || !reference) {
      console.error("Usage: cheki verify <bank> <ref> [-a <account>] [-p <phone>]");
      process.exit(1);
    }

    const verifier = new Verifier();
    const result = await verifier.verify({ bank, reference, accountNumber, phoneNumber });

    if (!result.ok) {
      console.error(`\n  FAIL: ${errorToMessage(result.error)}\n`);
      process.exit(1);
    }

    const r = result.value;
    const verdict = cliVerdict(r);
    console.log(`\n  ${verdict.headline}\n`);
    console.log(`  Bank:       ${r.bank}`);
    console.log(`  Reference:  ${r.reference}`);
    if (r.senderName) console.log(`  Sender:     ${r.senderName}`);
    if (r.senderAccount) console.log(`  Acct:       ${r.senderAccount}`);
    if (r.receiverName) console.log(`  Receiver:   ${r.receiverName}`);
    if (r.receiverAccount) console.log(`  Acct:       ${r.receiverAccount}`);
    if (r.amount) console.log(`  Amount:     ${r.amount.toLocaleString()} ${r.currency || "ETB"}`);
    if (r.date) console.log(`  Date:       ${r.date}`);
    if (r.branch) console.log(`  Branch:     ${r.branch}`);
    if (r.reason) console.log(`  Reason:     ${r.reason}`);
    console.log(`  Source:     ${r.sourceUrl}`);
    if (r.durationMs) console.log(`  Duration:   ${r.durationMs}ms`);
    console.log("");
    process.exit(verdict.exitCode);
  }

  if (command === "verify-qr") {
    const bank = args[1];
    const qrData = args[2];

    if (!bank || !qrData) {
      console.error("Usage: cheki verify-qr <bank> <qr-data>");
      process.exit(1);
    }

    const verifier = new Verifier();
    const result = await verifier.verify({ bank, reference: "", qrData });

    if (!result.ok) {
      console.error(`\n  FAIL: ${errorToMessage(result.error)}\n`);
      process.exit(1);
    }

    const r = result.value;
    const verdict = cliVerdict(r);
    console.log(`\n  ${verdict.headline}${verdict.exitCode === 0 ? " (looked up at the bank from the QR code)" : ""}\n`);
    console.log(`  Bank:       ${r.bank}`);
    console.log(`  Reference:  ${r.reference}`);
    if (r.senderName) console.log(`  Sender:     ${r.senderName}`);
    if (r.senderAccount) console.log(`  Acct:       ${r.senderAccount}`);
    if (r.receiverName) console.log(`  Receiver:   ${r.receiverName}`);
    if (r.receiverAccount) console.log(`  Acct:       ${r.receiverAccount}`);
    if (r.amount) console.log(`  Amount:     ${r.amount.toLocaleString()} ${r.currency || "ETB"}`);
    if (r.date) console.log(`  Date:       ${r.date}`);
    console.log(`  Source:     ${r.sourceUrl}`);
    if (r.durationMs) console.log(`  Duration:   ${r.durationMs}ms`);
    console.log("");
    process.exit(verdict.exitCode);
  }

  console.error(`Unknown command: ${command}. Run 'cheki --help' for usage.`);
  process.exit(1);
}

main().catch((e) => {
  console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
