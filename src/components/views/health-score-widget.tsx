"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HeartPulse, TrendingUp, TrendingDown, Minus, Lightbulb, X } from "lucide-react";
import { useHealthScore } from "@/hooks/use-finance";
import { cn } from "@/lib/utils";
import type { HealthScore } from "@/types";

export function HealthScoreWidget() {
  const { data: health, isLoading } = useHealthScore();
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-32 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!health) return null;

  const gradeColor = getGradeColor(health.grade);
  const scoreColor = getScoreColor(health.overall);

  return (
    <>
      <Card className="relative overflow-hidden">
        {/* Gradient background based on score */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-5",
            scoreColor === "emerald" && "from-emerald-500 to-teal-600",
            scoreColor === "amber" && "from-amber-500 to-orange-600",
            scoreColor === "rose" && "from-rose-500 to-red-600",
          )}
        />
        <CardHeader className="relative flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HeartPulse className={cn("h-4 w-4", scoreColor === "emerald" ? "text-emerald-600 dark:text-emerald-400" : scoreColor === "amber" ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400")} />
              Financial Health
            </CardTitle>
            <CardDescription className="text-xs">Composite score</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDetailsOpen(true)}>
            Details
          </Button>
        </CardHeader>
        <CardContent className="relative pt-2">
          <div className="flex items-center gap-4">
            {/* Score ring */}
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--muted)" strokeWidth="6" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke={scoreColor === "emerald" ? "#10b981" : scoreColor === "amber" ? "#f59e0b" : "#f43f5e"}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 34}
                  strokeDashoffset={2 * Math.PI * 34 * (1 - health.overall / 100)}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold tabular">{health.overall}</span>
                <span className={cn("text-xs font-bold", gradeColor)}>{health.grade}</span>
              </div>
            </div>

            {/* Factor breakdown */}
            <div className="min-w-0 flex-1 space-y-1.5">
              {health.factors.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 truncate text-[10px] text-muted-foreground">
                    {f.label}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        f.status === "good" ? "bg-emerald-500" : f.status === "fair" ? "bg-amber-500" : "bg-rose-500",
                      )}
                      style={{ width: `${f.score}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[10px] tabular text-muted-foreground">
                    {f.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top recommendation */}
          {health.recommendations.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 p-2.5">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium leading-tight">
                  {health.recommendations[0].title}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight line-clamp-2">
                  {health.recommendations[0].description}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Financial Health Score
            </DialogTitle>
            <DialogDescription>
              A composite metric based on savings, budget, liquidity, and trends.
            </DialogDescription>
          </DialogHeader>

          {/* Big score display */}
          <div className="flex items-center justify-center gap-6 py-4">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg className="h-32 w-32 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--muted)" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={scoreColor === "emerald" ? "#10b981" : scoreColor === "amber" ? "#f59e0b" : "#f43f5e"}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 34}
                  strokeDashoffset={2 * Math.PI * 34 * (1 - health.overall / 100)}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tabular">{health.overall}</span>
                <span className="text-sm text-muted-foreground">out of 100</span>
                <span className={cn("mt-0.5 text-base font-bold", gradeColor)}>Grade {health.grade}</span>
              </div>
            </div>
          </div>

          {/* Factor details */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Score Factors
            </p>
            {health.factors.map((f) => (
              <div key={f.key} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {f.status === "good" ? (
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    ) : f.status === "fair" ? (
                      <Minus className="h-4 w-4 text-amber-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-rose-500" />
                    )}
                    <span className="text-sm font-medium">{f.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular text-muted-foreground">{f.value}</span>
                    <span className={cn("text-sm font-bold tabular",
                      f.status === "good" ? "text-emerald-600 dark:text-emerald-400" :
                      f.status === "fair" ? "text-amber-600 dark:text-amber-400" :
                      "text-rose-600 dark:text-rose-400"
                    )}>
                      {f.score}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{f.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Weight: {f.weight}%</span>
                  <Progress value={f.score} className="h-1.5 flex-1" />
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recommendations
            </p>
            {health.recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
                <div className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  r.priority === "high" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" :
                  r.priority === "medium" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                )}>
                  {i + 1}
                </div>
                <div>
                  <p className="text-xs font-medium">{r.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case "A": return "text-emerald-600 dark:text-emerald-400";
    case "B": return "text-teal-600 dark:text-teal-400";
    case "C": return "text-amber-600 dark:text-amber-400";
    case "D": return "text-orange-600 dark:text-orange-400";
    default: return "text-rose-600 dark:text-rose-400";
  }
}

function getScoreColor(score: number): "emerald" | "amber" | "rose" {
  if (score >= 75) return "emerald";
  if (score >= 50) return "amber";
  return "rose";
}
