"use client";

import * as React from "react";
import { Plus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

export function LineItemsEditor({
  items,
  onChange,
  taxRate,
  discount,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  taxRate: number;
  discount: number;
}) {
  const update = (id: string, patch: Partial<LineItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id: string) => onChange(items.filter((it) => it.id !== id));
  const add = () =>
    onChange([
      ...items,
      { id: crypto.randomUUID(), description: "", quantity: 1, rate: 0 },
    ]);

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0);
  const taxable = Math.max(0, subtotal - (Number(discount) || 0));
  const tax = (taxable * (Number(taxRate) || 0)) / 100;
  const total = taxable + tax;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Line Items</Label>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}>
          <Plus className="h-3 w-3" /> Add item
        </Button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            No items yet. Click “Add item” to begin.
          </p>
        )}
        {items.map((it, idx) => (
          <Card key={it.id} className="grid grid-cols-12 gap-2 p-2">
            <div className="col-span-12 flex items-center gap-2 sm:col-span-6">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular text-muted-foreground">
                {idx + 1}
              </span>
              <Input
                className="h-8 text-sm"
                placeholder="Description"
                value={it.description}
                onChange={(e) => update(it.id, { description: e.target.value })}
              />
            </div>
            <Input
              type="number"
              className="col-span-5 h-8 text-sm tabular sm:col-span-2"
              placeholder="Qty"
              value={it.quantity}
              onChange={(e) => update(it.id, { quantity: Number(e.target.value) })}
            />
            <Input
              type="number"
              className="col-span-5 h-8 text-sm tabular sm:col-span-3"
              placeholder="Rate"
              value={it.rate}
              onChange={(e) => update(it.id, { rate: Number(e.target.value) })}
            />
            <div className="col-span-2 flex items-center justify-end sm:col-span-1">
              <button
                type="button"
                onClick={() => remove(it.id)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove item"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </Card>
        ))}
      </div>
      {items.length > 0 && (
        <div className="mt-3 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <Row label="Subtotal" value={subtotal} />
            <Row label={`Discount`} value={-(Number(discount) || 0)} />
            <Row label={`Tax (${Number(taxRate) || 0}%)`} value={tax} />
            <div className="flex justify-between border-t pt-1.5 font-semibold tabular">
              <span>Total</span>
              <span>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground tabular">
      <span className="text-xs">{label}</span>
      <span className="text-xs">
        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value)}
      </span>
    </div>
  );
}

export { Loader2 };
