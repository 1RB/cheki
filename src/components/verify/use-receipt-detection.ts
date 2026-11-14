"use client";

import { useDeferredValue, useMemo } from "react";
import { detectInput, type Detection } from "@/lib/verify/detect";

/**
 * Live bank + format detection for the smart input. Detection is pure and
 * cheap, but it runs on a deferred copy of the input so a 4 KB QR payload
 * pasted into the field never blocks typing.
 */
export function useReceiptDetection(
  input: string,
  opts: { lockedBank?: string; overrideBank?: string }
): Detection {
  const deferred = useDeferredValue(input);
  const { lockedBank, overrideBank } = opts;
  return useMemo(() => detectInput(deferred, { lockedBank, overrideBank }), [deferred, lockedBank, overrideBank]);
}
