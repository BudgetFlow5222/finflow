// ---------------------------------------------------------------------------
// Multi-currency support
// Base currency: INR (all data stored in INR). Display currency is user-selectable.
// Static exchange rates (approximate, sandbox-safe — no external API calls).
// ---------------------------------------------------------------------------

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP";

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  label: string;
  locale: string;
  /** Conversion rate from 1 INR → this currency. */
  rate: number;
}

// Static rates: 1 INR = X of target currency (approximate as of 2025).
export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  INR: { code: "INR", symbol: "₹", label: "Indian Rupee", locale: "en-IN", rate: 1 },
  USD: { code: "USD", symbol: "$", label: "US Dollar", locale: "en-US", rate: 0.012 },
  EUR: { code: "EUR", symbol: "€", label: "Euro", locale: "de-DE", rate: 0.011 },
  GBP: { code: "GBP", symbol: "£", label: "British Pound", locale: "en-GB", rate: 0.0095 },
};

export const CURRENCY_LIST = Object.values(CURRENCIES);

/**
 * Convert an amount from INR (base) to the target display currency.
 */
export function convertFromINR(amountINR: number, target: CurrencyCode): number {
  const meta = CURRENCIES[target];
  return amountINR * meta.rate;
}

/**
 * Format a converted amount using the target currency's locale and symbol.
 * `amountINR` is the base INR value; we convert + format in one step.
 */
export function formatMoney(
  amountINR: number,
  currency: CurrencyCode = "INR",
  opts: { compact?: boolean; sign?: boolean } = {},
): string {
  const { compact = false, sign = false } = opts;
  const meta = CURRENCIES[currency];
  const converted = convertFromINR(amountINR, currency);
  const formatter = new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: meta.code,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  });
  const formatted = formatter.format(Math.abs(converted));
  if (sign) {
    if (amountINR < 0) return `-${formatted}`;
    if (amountINR > 0) return `+${formatted}`;
  }
  return formatted;
}
