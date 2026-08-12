"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, RefreshCw, Brain, Zap, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUI } from "@/hooks/use-ui";
import type { ViewKey } from "@/components/app/sidebar";

interface AIInsight {
  type: "positive" | "warning" | "tip";
  title: string;
  description: string;
  targetView?: string;
}

interface AIInsightsData {
  summary: string;
  insights: AIInsight[];
  recommendation: string;
  cached?: boolean;
}

const VALID_VIEWS: ViewKey[] = ["dashboard", "accounts", "sales", "expenses", "invoices", "receivables", "payables", "transfers", "budget", "goals", "reports", "calendar", "tax", "customers", "vendors", "data", "search", "recurring"];

const VIEW_LABELS: Record<string, string> = {
  dashboard: "Dashboard", accounts: "Accounts", sales: "Sales", expenses: "Expenses",
  invoices: "Invoices", receivables: "Receivables", payables: "Payables", transfers: "Transfers",
  budget: "Budget", goals: "Goals", reports: "Reports", calendar: "Calendar", tax: "Tax",
};

function resolveView(view?: string): ViewKey | null {
  if (!view) return null;
  return VALID_VIEWS.includes(view as ViewKey) ? (view as ViewKey) : null;
}

export function AIInsightsWidget() {
  const { setView } = useUI();
  const [data, setData] = React.useState<AIInsightsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchInsights = React.useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = forceRefresh ? "/api/ai-insights?refresh=true" : "/api/ai-insights";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const iconForType = (type: AIInsight["type"]) => {
    switch (type) {
      case "positive":
        return <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case "tip":
        return <Lightbulb className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />;
    }
  };

  const borderForType = (type: AIInsight["type"]) => {
    switch (type) {
      case "positive":
        return "border-l-emerald-500";
      case "warning":
        return "border-l-amber-500";
      case "tip":
        return "border-l-cyan-500";
    }
  };

  const bgForType = (type: AIInsight["type"]) => {
    switch (type) {
      case "positive":
        return "bg-emerald-500/5";
      case "warning":
        return "bg-amber-500/5";
      case "tip":
        return "bg-cyan-500/5";
    }
  };

  return (
    <Card className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/5 via-primary/5 to-transparent" />
      <CardHeader className="relative flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
              <Brain className="h-4 w-4" />
            </div>
            AI Financial Insights
          </CardTitle>
          <CardDescription className="text-xs">Powered by AI analysis of your data</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => fetchInsights(true)}
          disabled={loading}
          title="Refresh insights (regenerate)"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="relative pt-2">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => fetchInsights(true)}>
              Try again
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-2.5">
            {/* Summary */}
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs leading-relaxed text-foreground flex-1">{data.summary}</p>
                {data.cached && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[9px] font-medium text-cyan-600 dark:text-cyan-400" title="Served from cache (5 min TTL)">
                    <Zap className="h-2.5 w-2.5" /> cached
                  </span>
                )}
              </div>
            </div>

            {/* Insights */}
            {data.insights?.map((insight, i) => {
              const targetView = resolveView(insight.targetView);
              return (
                <div
                  key={i}
                  role={targetView ? "button" : undefined}
                  tabIndex={targetView ? 0 : undefined}
                  onClick={targetView ? () => setView(targetView) : undefined}
                  onKeyDown={targetView ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setView(targetView); } } : undefined}
                  title={targetView ? `Click to view ${VIEW_LABELS[targetView] ?? targetView}` : undefined}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border-l-2 p-2.5",
                    borderForType(insight.type),
                    bgForType(insight.type),
                    targetView && "cursor-pointer hover:bg-accent/60 hover:border-primary/30 transition-all",
                  )}
                >
                  <div className="mt-0.5 shrink-0">{iconForType(insight.type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-tight">{insight.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {insight.description}
                    </p>
                  </div>
                  {targetView && (
                    <div className="flex shrink-0 items-center gap-1 self-center text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                      {VIEW_LABELS[targetView] ?? targetView}
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Recommendation */}
            {data.recommendation && (
              <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Recommendation
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed">{data.recommendation}</p>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
