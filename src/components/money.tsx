"use client";

import * as React from "react";
import { formatMoney } from "@/lib/currency";
import { useCurrency } from "@/hooks/use-currency";

interface Props {
  /** Amount in base INR. Will be converted to the active display currency. */
  amount: number;
  currency?: string;
  className?: string;
  sign?: boolean;
  muted?: boolean;
}

/** Money component — renders tabular-nums currency with positive/negative color.
 *  Converts from base INR to the user's chosen display currency. */
export function Money({ amount, className = "", sign = false, muted = false }: Props) {
  const { currency } = useCurrency();
  const negative = amount < 0;
  const positive = amount > 0;
  const color = muted
    ? "text-muted-foreground"
    : negative
      ? "text-destructive"
      : positive
        ? "text-emerald-600 dark:text-emerald-400"
        : "";
  return (
    <span className={`tabular font-medium ${color} ${className}`}>
      {sign && positive ? "+" : ""}
      {formatMoney(amount, currency, { sign })}
    </span>
  );
}
