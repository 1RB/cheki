import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Background for a bank monogram tile rendered as HTML.
 *
 * White initials on the raw brand colour measure 2.97:1 (Telebirr), 3.19:1
 * (M-Pesa) and 3.76:1 (eBirr) — all under the 4.5:1 a 15px bold label needs.
 * Mixing 25% of the colour toward black keeps the hue identifiable and puts
 * every tile over the threshold. The SVG logos keep the untouched colour:
 * they are logotypes, which WCAG 1.4.3 exempts.
 */
export function brandTileBg(color: string): string {
  return `color-mix(in srgb, ${color} 75%, #000)`
}
