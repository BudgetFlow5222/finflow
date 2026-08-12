"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export interface Field {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "textarea" | "switch";
  options?: { label: string; value: string }[];
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  colSpan?: 1 | 2;
  hint?: string;
}

export interface FormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: Field[];
  values: Record<string, unknown>;
  onValuesChange: (next: Record<string, unknown>) => void;
  onSubmit: () => void;
  isPending?: boolean;
  submitLabel?: string;
  size?: "sm" | "md" | "lg";
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  values,
  onValuesChange,
  onSubmit,
  isPending,
  submitLabel = "Save",
  size = "md",
}: FormDialogProps) {
  const set = (name: string, v: unknown) => onValuesChange({ ...values, [name]: v });

  const maxW = size === "lg" ? "max-w-2xl" : size === "sm" ? "max-w-sm" : "max-w-md";

  // Submit on Enter (but not in textarea)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${maxW} max-h-[90vh] overflow-y-auto scrollbar-thin`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2" onKeyDown={onKeyDown}>
          {fields.map((f) => {
            const colSpan = f.colSpan === 2 ? "col-span-2" : "col-span-2 sm:col-span-1";
            return (
              <div key={f.name} className={colSpan}>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  {f.label}
                  {f.required && <span className="ml-0.5 text-destructive">*</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={f.placeholder}
                    value={(values[f.name] as string) ?? ""}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                ) : f.type === "select" ? (
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={(values[f.name] as string) ?? ""}
                    onChange={(e) => set(f.name, e.target.value)}
                  >
                    <option value="">— Select —</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "switch" ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(values[f.name])}
                    onClick={() => set(f.name, !values[f.name])}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${values[f.name] ? "bg-primary" : "bg-input"}`}
                  >
                    <span
                      className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${values[f.name] ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring tabular"
                    placeholder={f.placeholder}
                    value={values[f.name] ?? ""}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    onChange={(e) =>
                      set(
                        f.name,
                        f.type === "number" ? Number(e.target.value) : e.target.value,
                      )
                    }
                  />
                )}
                {f.hint && <p className="mt-1 text-[10px] text-muted-foreground">{f.hint}</p>}
              </div>
            );
          })}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isPending} className="gap-1.5">
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
