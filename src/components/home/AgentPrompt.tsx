"use client";

import { useState } from "react";
import { Icon, CodeIcon, CopyCheckIcon } from "@/components/Icon";

/**
 * Copies a prompt that lets a coding agent (Claude Code, Cursor, ...) do the
 * integration. Built at click time from window.location.origin so it is
 * correct on whatever domain the visitor arrived on.
 */
function buildPrompt(origin: string): string {
  return `Verify an Ethiopian bank receipt with cheki. It is free, needs no signup, and no API key.

1. Read ${origin}/llms.txt. It documents every endpoint, bank code and reference format.
2. POST ${origin}/api/verify with a JSON body:
     {"bank": "cbe", "reference": "https://mbreciept.cbe.com.et/<receipt-id>"}
   A receipt link or Receipt ID is enough for most banks. accountNumber is
   needed only for boa and for older CBE receipts that show just an FT
   reference. GET ${origin}/api/banks lists each bank's formats, current first.
3. Use the response:
     result.verified        the answer; true means the bank's own record confirms this receipt
     result.decodedOnly     true for a BOA QR the bank could not confirm: treat as NOT verified
     result.amount          amount in ETB
     result.senderName      who paid
     result.receiverName    who was paid
     result.sourceUrl       the public bank endpoint that produced this
   Telebirr and M-Pesa only answer Ethiopian networks; from elsewhere, expect an
   error with a fallbackUrl to open in the user's browser.
4. To reconcile many receipts, POST ${origin}/api/verify/batch with
   {"receipts": [{...}, ...]}, up to 20 per call.
5. GET ${origin}/api/health reports per-bank latency if a check is slow.

Source: https://github.com/1RB/cheki`;
}

export function AgentPrompt() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildPrompt(window.location.origin));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="hp-agent">
      <button type="button" onClick={copy} className="hp-agent-btn">
        <Icon icon={copied ? CopyCheckIcon : CodeIcon} size={16} color={copied ? "var(--green-dark)" : "var(--ink-2)"} />
        <span aria-live="polite">{copied ? "Prompt copied" : "Let your agent integrate it"}</span>
      </button>
      <p className="hp-agent-hint">
        {copied
          ? "Paste it into Claude Code, Cursor or any agent."
          : "Copies a prompt for Claude Code, Cursor or any coding agent. It reads cheki's llms.txt and writes the integration."}
      </p>
    </div>
  );
}
