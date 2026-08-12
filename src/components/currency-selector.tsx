"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCurrency } from "@/hooks/use-currency";
import { CURRENCY_LIST } from "@/lib/currency";

/**
 * Currency selector — lets the user pick the display currency.
 * All stored amounts are in INR (base); this controls conversion + formatting.
 */
export function CurrencySelector({ compact = false }: { compact?: boolean }) {
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = React.useState(false);

  const active = CURRENCY_LIST.find((c) => c.code === currency) ?? CURRENCY_LIST[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 rounded-full font-medium tabular",
            compact && "w-9 justify-center px-0",
          )}
          aria-label="Select display currency"
          title={`Display currency: ${active.label}`}
        >
          <Coins className="h-3.5 w-3.5 text-emerald-500" />
          {!compact && <span className="text-xs">{active.code}</span>}
          {!compact && <ChevronsUpDown className="h-3 w-3 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        <div className="mb-1 flex items-center gap-1.5 px-2 py-1.5">
          <Coins className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Display Currency
          </span>
        </div>
        <div className="h-px bg-border" />
        <div className="mt-1 space-y-0.5">
          {CURRENCY_LIST.map((c) => {
            const isActive = c.code === currency;
            return (
              <button
                key={c.code}
                onClick={() => {
                  setCurrency(c.code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-bold tabular">
                    {c.symbol}
                  </span>
                  <span className="flex flex-col items-start leading-tight">
                    <span className="font-medium">{c.code}</span>
                    <span className="text-[10px] text-muted-foreground">{c.label}</span>
                  </span>
                </span>
                {isActive && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            );
          })}
        </div>
        <div className="mt-2 rounded-md bg-muted/60 px-2.5 py-1.5">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Amounts are stored in INR and converted for display. Rates are approximate.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
