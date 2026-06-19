/**
 * Manifest loader - reads banks.json and provides typed access.
 *
 * The manifest is the single source of truth for bank configuration.
 * When a bank rotates its URL, patch banks.json - no code change needed.
 */
import banksData from "./banks.json";
import type { BankManifestEntry } from "../core/types";

const banks: BankManifestEntry[] = banksData as BankManifestEntry[];

const banksById = new Map<string, BankManifestEntry>(
  banks.map((b) => [b.id.toLowerCase(), b])
);

export function getBank(id: string): BankManifestEntry | undefined {
  return banksById.get(id.toLowerCase());
}

export function getAllBanks(): BankManifestEntry[] {
  return banks;
}

export function getLiveBanks(): BankManifestEntry[] {
  return banks.filter((b) => b.status === "live");
}

export function getParserName(bankId: string): string | undefined {
  return getBank(bankId)?.parser;
}

/**
 * Fuzzy match bank IDs for error suggestions.
 * Returns the closest matching bank ID if the input is close enough.
 */
export function suggestBank(input: string): string | undefined {
  const inputLower = input.toLowerCase();
  // Direct substring match
  for (const bank of banks) {
    if (bank.id.toLowerCase().includes(inputLower) || inputLower.includes(bank.id.toLowerCase())) {
      return bank.id;
    }
    if (bank.swift && bank.swift.toLowerCase().includes(inputLower.toUpperCase())) {
      return bank.id;
    }
    if (bank.name.toLowerCase().includes(inputLower)) {
      return bank.id;
    }
  }
  // Levenshtein-lite: check for close matches (within 2 edits)
  let best: string | undefined;
  let bestDist = 3;
  for (const bank of banks) {
    const dist = levenshtein(inputLower, bank.id.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = bank.id;
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
