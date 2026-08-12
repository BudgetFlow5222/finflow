"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Target,
  PiggyBank,
  RefreshCw,
  MoreHorizontal,
  CalendarDays,
  TrendingUp,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { FormDialog, type Field } from "@/components/forms/form-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useGoals,
  useCreate,
  useUpdate,
  useDelete,
  qk,
} from "@/hooks/use-finance";
import { useUI } from "@/hooks/use-ui";
import { toast } from "sonner";
import { formatDate, cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { formatMoney } from "@/lib/currency";
import type { SavingsGoal } from "@/types";
import {
  CelebrationOverlay,
  type CelebrationMilestone,
} from "@/components/views/celebration-overlay";
import {
  GoalTemplatesDialog,
  type GoalTemplatePayload,
} from "@/components/views/goal-templates-dialog";

// Milestone thresholds (in percent) checked when a goal's saved amount
// increases. Highest-first so we celebrate the largest threshold crossed.
const GOAL_MILESTONES = [100, 75, 50, 25] as const;

// ---------------------------------------------------------------------------
// Form field definitions
// ---------------------------------------------------------------------------

const GOAL_COLORS = [
  { label: "Emerald", value: "#10b981" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Sky", value: "#0ea5e9" },
  { label: "Lime", value: "#84cc16" },
];

const GOAL_FIELDS: Field[] = [
  {
    name: "name",
    label: "Goal name",
    type: "text",
    placeholder: "e.g. Emergency Fund",
    required: true,
    colSpan: 2,
  },
  {
    name: "targetAmount",
    label: "Target amount",
    type: "number",
    required: true,
    placeholder: "0.00",
  },
  {
    name: "savedAmount",
    label: "Already saved",
    type: "number",
    defaultValue: 0,
    placeholder: "0.00",
  },
  { name: "targetDate", label: "Target date", type: "date" },
  {
    name: "color",
    label: "Color",
    type: "select",
    options: GOAL_COLORS.map((c) => ({ label: c.label, value: c.value })),
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    defaultValue: "ACTIVE",
    options: [
      { label: "Active", value: "ACTIVE" },
      { label: "Completed", value: "COMPLETED" },
      { label: "Paused", value: "PAUSED" },
    ],
  },
  { name: "notes", label: "Notes", type: "textarea", colSpan: 2, placeholder: "Optional notes" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toInputDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function goalStatusVariant(s: string) {
  switch (s) {
    case "COMPLETED":
      return "success" as const;
    case "PAUSED":
      return "warning" as const;
    default:
      return "info" as const;
  }
}

function pct(saved: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, (saved / target) * 100);
}

// ---------------------------------------------------------------------------
// Circular progress (SVG)
// ---------------------------------------------------------------------------

function CircularProgress({
  percentage,
  color,
  size = 96,
}: {
  percentage: number;
  color: string;
  size?: number;
}) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, percentage)) / 100);
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        className="-rotate-90"
        viewBox="0 0 80 80"
        width={size}
        height={size}
        aria-hidden
      >
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="7"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color || "var(--primary)"}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-semibold tabular">
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function GoalsView() {
  const { data: goals, isLoading, refetch } = useGoals();
  const { pendingForm, consumeForm } = useUI();
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SavingsGoal | null>(null);
  const [values, setValues] = React.useState<Record<string, unknown>>({});

  // Update progress dialog state
  const [progressOpen, setProgressOpen] = React.useState(false);
  const [progressGoal, setProgressGoal] = React.useState<SavingsGoal | null>(null);
  const [progressAmount, setProgressAmount] = React.useState<string>("");

  // Goal templates dialog state
  const [templatesOpen, setTemplatesOpen] = React.useState(false);

  // Celebration overlay state — set when a milestone is crossed after a
  // successful progress update. Cleared by closing the overlay.
  const [celebration, setCelebration] = React.useState<{
    goalName: string;
    milestone: CelebrationMilestone;
    savedAmount: number;
    targetAmount: number;
  } | null>(null);

  const create = useCreate("/api/goals", [qk.goals, qk.dashboard]);
  const update = useUpdate((id) => `/api/goals/${id}`, [qk.goals, qk.dashboard]);
  const remove = useDelete((id) => `/api/goals/${id}`, [qk.goals, qk.dashboard]);

  React.useEffect(() => {
    const f = consumeForm();
    if (f === "goal") openNew();
  }, [pendingForm]);

  const openNew = () => {
    setEditing(null);
    setValues({
      savedAmount: 0,
      status: "ACTIVE",
      color: "#10b981",
    });
    setOpen(true);
  };

  const openEdit = (g: SavingsGoal) => {
    setEditing(g);
    setValues({
      name: g.name,
      targetAmount: g.targetAmount,
      savedAmount: g.savedAmount,
      targetDate: toInputDate(g.targetDate),
      color: g.color ?? "#10b981",
      status: g.status,
      notes: g.notes ?? "",
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!values.name) return toast.error("Name is required");
    const target = Number(values.targetAmount);
    if (!Number.isFinite(target) || target <= 0) {
      return toast.error("Target must be a positive number");
    }
    // Normalize date -> ISO string (or null) for the API.
    const payload: Record<string, unknown> = { ...values };
    if (values.targetDate) {
      const d = new Date(String(values.targetDate));
      payload.targetDate = Number.isNaN(d.getTime()) ? null : d.toISOString();
    } else {
      payload.targetDate = null;
    }
    if (editing) {
      await update.mutateAsync({ id: editing.id, body: payload });
      toast.success("Goal updated");
    } else {
      await create.mutateAsync(payload);
      toast.success("Goal created");
    }
    setOpen(false);
  };

  const handleDelete = async (g: SavingsGoal) => {
    if (!confirm(`Delete goal “${g.name}”? This cannot be undone.`)) return;
    await remove.mutateAsync(g.id);
    toast.success("Goal deleted");
  };

  const openProgress = (g: SavingsGoal) => {
    setProgressGoal(g);
    setProgressAmount("");
    setProgressOpen(true);
  };

  const handleCreateFromTemplate = async (payload: GoalTemplatePayload) => {
    await create.mutateAsync(payload);
    toast.success(`Goal “${payload.name}” created`);
  };

  const handleProgressSubmit = async () => {
    if (!progressGoal) return;
    const add = Number(progressAmount);
    if (!Number.isFinite(add) || add === 0) {
      return toast.error("Enter a non-zero amount");
    }
    const prevSaved = progressGoal.savedAmount;
    const next = Math.max(0, prevSaved + add);
    await update.mutateAsync({
      id: progressGoal.id,
      body: {
        name: progressGoal.name,
        targetAmount: progressGoal.targetAmount,
        savedAmount: next,
        targetDate: progressGoal.targetDate
          ? new Date(progressGoal.targetDate).toISOString()
          : null,
        color: progressGoal.color,
        status: progressGoal.status,
        notes: progressGoal.notes,
      },
    });
    toast.success(
      add >= 0
        ? `Added ${fmt(add)} to ${progressGoal.name}`
        : `Removed ${fmt(Math.abs(add))} from ${progressGoal.name}`,
    );
    setProgressOpen(false);

    // Detect milestone crossings — only on positive contributions and when
    // the target is set. We compare the previous progress percentage to the
    // new one and celebrate the highest threshold that was crossed.
    const target = progressGoal.targetAmount;
    if (target > 0 && add > 0) {
      const prevPct = (prevSaved / target) * 100;
      const newPct = (next / target) * 100;
      for (const m of GOAL_MILESTONES) {
        if (prevPct < m && newPct >= m) {
          setCelebration({
            goalName: progressGoal.name,
            milestone:
              m === 100
                ? "completed"
                : (`${m}%` as "25%" | "50%" | "75%" | "100%"),
            savedAmount: next,
            targetAmount: target,
          });
          break; // Only celebrate the highest milestone crossed
        }
      }
    }
  };

  // Aggregations
  const totalTarget = goals?.reduce((s, g) => s + g.targetAmount, 0) ?? 0;
  const totalSaved = goals?.reduce((s, g) => s + g.savedAmount, 0) ?? 0;
  const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
  const activeCount = goals?.filter((g) => g.status === "ACTIVE").length ?? 0;
  const completedCount = goals?.filter((g) => g.status === "COMPLETED").length ?? 0;

  if (isLoading) return <GoalsSkeleton />;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-violet-500" />
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Target
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {fmt(totalTarget)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              across {goals?.length ?? 0} goal{(goals?.length ?? 0) === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Saved
            </p>
            <p className="mt-1 text-2xl font-semibold tabular text-emerald-600 dark:text-emerald-400">
              {fmt(totalSaved)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {completedCount} completed · {activeCount} active
            </p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-cyan-500" />
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Overall Progress
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {overallPct.toFixed(1)}%
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all"
                style={{ width: `${Math.min(100, overallPct)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Savings Goals</h2>
          <p className="text-xs text-muted-foreground">
            Track progress toward emergency funds, big purchases and milestones
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setTemplatesOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5" /> Browse Templates
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Goal
          </Button>
        </div>
      </div>

      {/* Goals grid */}
      {goals && goals.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => {
            const percentage = pct(g.savedAmount, g.targetAmount);
            const remaining = Math.max(0, g.targetAmount - g.savedAmount);
            const days = g.targetDate ? daysLeft(g.targetDate) : null;
            const isComplete = g.status === "COMPLETED" || g.savedAmount >= g.targetAmount;
            return (
              <Card
                key={g.id}
                className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-md"
              >
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: g.color ?? "var(--primary)" }}
                />
                <CardContent className="flex flex-1 flex-col p-4">
                  {/* Header row: icon + name + status + kebab */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
                        style={{ backgroundColor: g.color ?? "var(--primary)" }}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Target className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">{g.name}</p>
                        <div className="mt-0.5">
                          <StatusBadge variant={goalStatusVariant(g.status)}>
                            {g.status}
                          </StatusBadge>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openProgress(g)}>
                          <TrendingUp className="mr-2 h-3.5 w-3.5" /> Update progress
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(g)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(g)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Progress ring + amounts */}
                  <div className="mt-4 flex items-center gap-4">
                    <CircularProgress percentage={percentage} color={g.color ?? "var(--primary)"} />
                    <div className="flex-1 space-y-1">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Saved
                        </p>
                        <p className="text-sm font-semibold tabular text-emerald-600 dark:text-emerald-400">
                          {fmt(g.savedAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Target
                        </p>
                        <p className="text-sm font-semibold tabular">
                          {fmt(g.targetAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Remaining
                        </p>
                        <p
                          className={cn(
                            "text-sm font-semibold tabular",
                            remaining > 0 ? "" : "text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          {fmt(remaining)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer: deadline + update button */}
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {g.targetDate ? (
                        <span
                          className={cn(
                            days !== null && days < 0
                              ? "text-rose-500"
                              : days !== null && days <= 14
                                ? "text-amber-600 dark:text-amber-400"
                                : "",
                          )}
                        >
                          {days === null
                            ? ""
                            : days < 0
                              ? `${Math.abs(days)}d overdue`
                              : days === 0
                                ? "Due today"
                                : `${days}d left`}
                          {" · "}
                          {formatDate(g.targetDate, "short")}
                        </span>
                      ) : (
                        <span>No deadline</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 px-2 text-[11px]"
                      onClick={() => openProgress(g)}
                      disabled={g.status === "PAUSED"}
                    >
                      <Plus className="h-3 w-3" /> Update
                    </Button>
                  </div>

                  {g.notes && (
                    <p className="mt-3 line-clamp-2 rounded-md bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
                      {g.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Add new card */}
          <button
            onClick={openNew}
            className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <Plus className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium">Add goal</span>
            <span className="text-[10px]">Emergency fund, vacation, gadget…</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PiggyBank className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold">No savings goals yet</p>
            <p className="text-xs text-muted-foreground">
              Set your first goal — an emergency fund, a gadget, a trip — and start tracking progress.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New Goal
          </Button>
        </div>
      )}

      {/* Create / edit dialog */}
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Goal" : "New Goal"}
        description={
          editing
            ? "Update the goal details. Status auto-flips to Completed when saved ≥ target."
            : "Define a savings goal with a target amount, deadline and color."
        }
        fields={GOAL_FIELDS}
        values={values}
        onValuesChange={setValues}
        onSubmit={handleSubmit}
        isPending={create.isPending || update.isPending}
        submitLabel={editing ? "Save changes" : "Create goal"}
      />

      {/* Update progress dialog */}
      <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Update progress
            </DialogTitle>
            <DialogDescription>
              {progressGoal
                ? `Add to or withdraw from “${progressGoal.name}”. Use a negative amount to withdraw.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {progressGoal && (
            <div className="space-y-3 py-1">
              <div className="rounded-md bg-muted/60 p-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current saved</span>
                  <span className="font-semibold tabular">
                    {fmt(progressGoal.savedAmount)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Target</span>
                  <span className="font-semibold tabular">
                    {fmt(progressGoal.targetAmount)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-semibold tabular text-emerald-600 dark:text-emerald-400">
                    {fmt(Math.max(0, progressGoal.targetAmount - progressGoal.savedAmount))}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="progress-amount">Amount to add</Label>
                <Input
                  id="progress-amount"
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 5000"
                  value={progressAmount}
                  onChange={(e) => setProgressAmount(e.target.value)}
                  autoFocus
                />
                <p className="text-[10px] text-muted-foreground">
                  Negative amounts reduce saved balance.
                </p>
              </div>

              {progressAmount &&
                Number(progressAmount) !== 0 &&
                Number.isFinite(Number(progressAmount)) && (
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">New saved</span>
                      <span className="font-semibold tabular text-emerald-600 dark:text-emerald-400">
                        {fmt(
                          Math.max(0, progressGoal.savedAmount + Number(progressAmount)),
                        )}
                      </span>
                    </div>
                  </div>
                )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              onClick={() => setProgressOpen(false)}
              disabled={update.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProgressSubmit}
              disabled={update.isPending}
              className="gap-1.5"
            >
              {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Update progress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Goal achievement celebration overlay */}
      <CelebrationOverlay
        open={!!celebration}
        onOpenChange={(v) => !v && setCelebration(null)}
        goalName={celebration?.goalName ?? ""}
        milestone={celebration?.milestone ?? "25%"}
        savedAmount={celebration?.savedAmount ?? 0}
        targetAmount={celebration?.targetAmount ?? 0}
      />

      {/* Goal templates dialog */}
      <GoalTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onCreate={handleCreateFromTemplate}
        isPending={create.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function daysLeft(date: string | Date): number {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function GoalsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
