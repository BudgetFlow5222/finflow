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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  PiggyBank,
  Home,
  Plane,
  Car,
  GraduationCap,
  Heart,
  Laptop,
  Sparkles,
  Check,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  targetAmount: number;
  color: string;
  icon: string;
  category: string;
  suggestedMonths: number;
}

export interface GoalTemplatePayload {
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string | null;
  color: string;
  icon: string;
  status: string;
  notes: string;
}

interface GoalTemplatesDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (payload: GoalTemplatePayload) => Promise<void> | void;
  isPending?: boolean;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: "emergency-fund",
    name: "Emergency Fund",
    description: "3-6 months of expenses saved for emergencies",
    targetAmount: 300000, // 3 months of avg expenses
    color: "#10b981", // emerald
    icon: "ShieldCheck",
    category: "Safety",
    suggestedMonths: 12,
  },
  {
    id: "retirement",
    name: "Retirement Fund",
    description: "Long-term savings for retirement",
    targetAmount: 5000000,
    color: "#8b5cf6", // violet
    icon: "PiggyBank",
    category: "Long-term",
    suggestedMonths: 120,
  },
  {
    id: "home-down-payment",
    name: "Home Down Payment",
    description: "Save for a down payment on a house",
    targetAmount: 1500000,
    color: "#06b6d4", // cyan
    icon: "Home",
    category: "Major Purchase",
    suggestedMonths: 36,
  },
  {
    id: "vacation",
    name: "Dream Vacation",
    description: "Save for your next trip",
    targetAmount: 100000,
    color: "#f59e0b", // amber
    icon: "Plane",
    category: "Lifestyle",
    suggestedMonths: 8,
  },
  {
    id: "new-car",
    name: "New Car",
    description: "Save for a vehicle purchase",
    targetAmount: 800000,
    color: "#ef4444", // red
    icon: "Car",
    category: "Major Purchase",
    suggestedMonths: 24,
  },
  {
    id: "education",
    name: "Education Fund",
    description: "Save for education or skill development",
    targetAmount: 250000,
    color: "#14b8a6", // teal
    icon: "GraduationCap",
    category: "Personal",
    suggestedMonths: 18,
  },
  {
    id: "wedding",
    name: "Wedding Fund",
    description: "Save for wedding expenses",
    targetAmount: 500000,
    color: "#ec4899", // pink
    icon: "Heart",
    category: "Life Event",
    suggestedMonths: 12,
  },
  {
    id: "new-laptop",
    name: "New Laptop",
    description: "Save for a new computer or device",
    targetAmount: 120000,
    color: "#6366f1", // indigo
    icon: "Laptop",
    category: "Lifestyle",
    suggestedMonths: 6,
  },
];

const CATEGORIES = [
  "All",
  "Safety",
  "Long-term",
  "Major Purchase",
  "Lifestyle",
  "Personal",
  "Life Event",
] as const;

// Icon name → component map. Keeping this explicit (rather than dynamic) gives
// us full type safety and avoids `any` lookups.
const ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  ShieldCheck,
  PiggyBank,
  Home,
  Plane,
  Car,
  GraduationCap,
  Heart,
  Laptop,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTimeline(months: number): string {
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = months / 12;
  if (Number.isInteger(years)) return `${years} year${years === 1 ? "" : "s"}`;
  const y = Math.floor(years);
  const m = months - y * 12;
  return `${y}y ${m}m`;
}

// Suggested monthly contribution to reach the target in the suggested timeline.
function monthlyContribution(target: number, months: number): number {
  if (months <= 0) return 0;
  return Math.round(target / months);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GoalTemplatesDialog({
  open,
  onOpenChange,
  onCreate,
  isPending,
}: GoalTemplatesDialogProps) {
  const [activeCategory, setActiveCategory] =
    React.useState<(typeof CATEGORIES)[number]>("All");
  const [selected, setSelected] = React.useState<GoalTemplate | null>(null);

  // Confirmation form state
  const [name, setName] = React.useState("");
  const [targetAmount, setTargetAmount] = React.useState("");
  const [targetDate, setTargetDate] = React.useState("");

  // Reset everything when the dialog opens.
  React.useEffect(() => {
    if (open) {
      setSelected(null);
      setActiveCategory("All");
      setName("");
      setTargetAmount("");
      setTargetDate("");
    }
  }, [open]);

  const handleSelect = (tpl: GoalTemplate) => {
    setSelected(tpl);
    setName(tpl.name);
    setTargetAmount(String(tpl.targetAmount));
    setTargetDate(toInputDate(addMonths(new Date(), tpl.suggestedMonths)));
  };

  const handleBack = () => {
    setSelected(null);
  };

  const filtered = React.useMemo(
    () =>
      activeCategory === "All"
        ? GOAL_TEMPLATES
        : GOAL_TEMPLATES.filter((t) => t.category === activeCategory),
    [activeCategory],
  );

  const handleSubmit = async () => {
    if (!selected) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const target = Number(targetAmount);
    if (!Number.isFinite(target) || target <= 0) return;

    let dateISO: string | null = null;
    if (targetDate) {
      const d = new Date(targetDate);
      if (!Number.isNaN(d.getTime())) dateISO = d.toISOString();
    }

    await onCreate({
      name: trimmed,
      targetAmount: target,
      savedAmount: 0,
      targetDate: dateISO,
      color: selected.color,
      icon: selected.icon,
      status: "ACTIVE",
      notes: selected.description,
    });

    // On successful create, close the dialog.
    setSelected(null);
    onOpenChange(false);
  };

  // Compute preview values for the confirmation form.
  const targetNum = Number(targetAmount);
  const isValidTarget = Number.isFinite(targetNum) && targetNum > 0;
  const monthly = isValidTarget && selected
    ? monthlyContribution(targetNum, selected.suggestedMonths)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" />
            Goal Templates
          </DialogTitle>
          <DialogDescription>
            Quick-start your savings journey with pre-built goal templates.
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <>
            {/* Category filter chips */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCategory(c)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    activeCategory === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Template grid */}
            <div className="grid gap-3 py-2 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((tpl) => {
                const Icon = ICONS[tpl.icon] ?? Sparkles;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelect(tpl)}
                    className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                        style={{ backgroundColor: tpl.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {tpl.name}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {tpl.category}
                        </p>
                      </div>
                    </div>
                    <p className="line-clamp-2 min-h-[2rem] text-xs text-muted-foreground">
                      {tpl.description}
                    </p>
                    <div className="mt-auto flex items-center justify-between border-t border-border pt-2 text-xs">
                      <span className="font-semibold tabular">
                        {formatCurrency(tpl.targetAmount, "INR", {
                          compact: true,
                        })}
                      </span>
                      <span className="text-muted-foreground">
                        {formatTimeline(tpl.suggestedMonths)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <ConfirmationForm
            template={selected}
            name={name}
            targetAmount={targetAmount}
            targetDate={targetDate}
            onNameChange={setName}
            onTargetAmountChange={setTargetAmount}
            onTargetDateChange={setTargetDate}
            monthly={monthly}
            isValidTarget={isValidTarget}
          />
        )}

        {selected && (
          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={isPending}
              className="gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !name.trim() || !isValidTarget}
              className="gap-1.5"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Create Goal
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Confirmation form (inline, shown when a template is selected)
// ---------------------------------------------------------------------------

interface ConfirmationFormProps {
  template: GoalTemplate;
  name: string;
  targetAmount: string;
  targetDate: string;
  onNameChange: (v: string) => void;
  onTargetAmountChange: (v: string) => void;
  onTargetDateChange: (v: string) => void;
  monthly: number;
  isValidTarget: boolean;
}

function ConfirmationForm({
  template,
  name,
  targetAmount,
  targetDate,
  onNameChange,
  onTargetAmountChange,
  onTargetDateChange,
  monthly,
  isValidTarget,
}: ConfirmationFormProps) {
  const Icon = ICONS[template.icon] ?? Sparkles;
  return (
    <div className="space-y-4 py-2">
      {/* Template summary banner */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
          style={{ backgroundColor: template.color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{template.name}</p>
          <p className="line-clamp-1 text-[11px] text-muted-foreground">
            {template.description}
          </p>
        </div>
        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {template.category}
        </span>
      </div>

      {/* Form fields */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="tpl-name" className="text-xs">
            Goal name
          </Label>
          <Input
            id="tpl-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Goal name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-target" className="text-xs">
            Target amount
          </Label>
          <Input
            id="tpl-target"
            type="number"
            inputMode="decimal"
            min={1}
            step={1}
            value={targetAmount}
            onChange={(e) => onTargetAmountChange(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-date" className="text-xs">
            Target date
          </Label>
          <Input
            id="tpl-date"
            type="date"
            value={targetDate}
            onChange={(e) => onTargetDateChange(e.target.value)}
          />
        </div>
      </div>

      {/* Contribution hint */}
      {isValidTarget && monthly > 0 && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              Suggested monthly contribution
            </span>
            <span className="font-semibold tabular text-emerald-600 dark:text-emerald-400">
              {formatCurrency(monthly)} / mo
            </span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            To reach {formatCurrency(Number(targetAmount) || 0)} in{" "}
            {formatTimeline(template.suggestedMonths)}, save about{" "}
            {formatCurrency(monthly)} per month.
          </p>
        </div>
      )}
    </div>
  );
}
