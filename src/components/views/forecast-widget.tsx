"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingDown, TrendingUp, Calendar, Wind, Zap } from "lucide-react";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { formatDate, cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { formatMoney } from "@/lib/currency";

interface ForecastData {
  currentBalance: number;
  avgDailyIncome: number;
  avgDailyExpense: number;
  avgDailyNet: number;
  projections: { day30: number; day60: number; day90: number };
  minBalance: number;
  minBalanceDay: number;
  minBalanceDate: string;
  zeroDay: number | null;
  runwayDays: number;
  forecast: { day: number; dateLabel: string; projectedBalance: number }[];
  upcomingEvents: { type: string; description: string; amount: number; dateLabel: string }[];
  summary: { status: "healthy" | "warning" | "danger"; message: string };
}

export function ForecastWidget() {
  const [data, setData] = React.useState<ForecastData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const { currency } = useCurrency();
  const fmt = (amount: number, opts?: { compact?: boolean; sign?: boolean }) =>
    formatMoney(amount, currency, opts ?? {});

  const fetchForecast = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/forecast");
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load forecast");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Wind className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            Cash Flow Forecast
          </CardTitle>
          <CardDescription className="text-xs">90-day projection</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Skeleton className="h-60 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Wind className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            Cash Flow Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="text-xs text-muted-foreground">{error ?? "No data"}</p>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={fetchForecast}>
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusColor =
    data.summary.status === "danger"
      ? "text-rose-600 dark:text-rose-400"
      : data.summary.status === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";

  const statusBg =
    data.summary.status === "danger"
      ? "bg-rose-500/5 border-rose-500/20"
      : data.summary.status === "warning"
        ? "bg-amber-500/5 border-amber-500/20"
        : "bg-emerald-500/5 border-emerald-500/20";

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent" />
      <CardHeader className="relative flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Wind className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            Cash Flow Forecast
          </CardTitle>
          <CardDescription className="text-xs">
            90-day projection based on AR, AP & recurring
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Less" : "Details"}
        </Button>
      </CardHeader>
      <CardContent className="relative pt-2">
        {/* Status banner */}
        <div className={cn("mb-3 flex items-center gap-2 rounded-lg border p-2.5", statusBg)}>
          {data.summary.status === "danger" ? (
            <AlertTriangle className={cn("h-4 w-4 shrink-0", statusColor)} />
          ) : data.summary.status === "warning" ? (
            <TrendingDown className={cn("h-4 w-4 shrink-0", statusColor)} />
          ) : (
            <TrendingUp className={cn("h-4 w-4 shrink-0", statusColor)} />
          )}
          <p className={cn("text-xs font-medium", statusColor)}>{data.summary.message}</p>
        </div>

        {/* Projection cards */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">30 days</p>
            <p className={cn("mt-1 text-sm font-bold tabular", data.projections.day30 < 0 ? "text-rose-600 dark:text-rose-400" : "")}>
              {fmt(data.projections.day30, { compact: true })}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">60 days</p>
            <p className={cn("mt-1 text-sm font-bold tabular", data.projections.day60 < 0 ? "text-rose-600 dark:text-rose-400" : "")}>
              {fmt(data.projections.day60, { compact: true })}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">90 days</p>
            <p className={cn("mt-1 text-sm font-bold tabular", data.projections.day90 < 0 ? "text-rose-600 dark:text-rose-400" : "")}>
              {fmt(data.projections.day90, { compact: true })}
            </p>
          </div>
        </div>

        {/* Forecast chart */}
        <ForecastChart
          data={data.forecast}
          currentBalance={data.currentBalance}
          minBalance={data.minBalance}
          zeroDay={data.zeroDay}
        />

        {/* Key metrics row */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-emerald-500" /> Avg daily in
            </p>
            <p className="text-xs font-semibold tabular text-emerald-600 dark:text-emerald-400">
              {fmt(data.avgDailyIncome, { compact: true })}
            </p>
          </div>
          <div>
            <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <TrendingDown className="h-3 w-3 text-rose-500" /> Avg daily out
            </p>
            <p className="text-xs font-semibold tabular text-rose-600 dark:text-rose-400">
              {fmt(data.avgDailyExpense, { compact: true })}
            </p>
          </div>
          <div>
            <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <Zap className="h-3 w-3 text-cyan-500" /> Runway
            </p>
            <p className={cn("text-xs font-semibold tabular", data.runwayDays < 30 ? "text-rose-600 dark:text-rose-400" : data.runwayDays < 90 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
              {data.runwayDays > 365 ? "∞" : `${data.runwayDays}d`}
            </p>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 space-y-3 animate-slide-down">
            {/* Min balance info */}
            {data.minBalance < data.currentBalance && (
              <div className="rounded-lg border border-border p-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Calendar className="h-3 w-3" /> Lowest Point
                </p>
                <p className="mt-1 text-xs">
                  <span className={cn("font-bold tabular", data.minBalance < 0 ? "text-rose-600 dark:text-rose-400" : "")}>
                    {fmt(data.minBalance)}
                  </span>
                  <span className="text-muted-foreground"> on day {data.minBalanceDay} ({formatDate(data.minBalanceDate)})</span>
                </p>
              </div>
            )}

            {/* Upcoming events */}
            {data.upcomingEvents.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Upcoming Events (14 days)
                </p>
                <div className="max-h-40 space-y-1 overflow-y-auto scrollbar-thin">
                  {data.upcomingEvents.map((event, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
                      <div className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        event.amount > 0
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                      )}>
                        {event.amount > 0 ? "↑" : "↓"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{event.description}</p>
                        <p className="text-[10px] text-muted-foreground">{event.dateLabel} · {event.type}</p>
                      </div>
                      <span className={cn("shrink-0 text-xs font-semibold tabular", event.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                        {event.amount > 0 ? "+" : ""}{fmt(event.amount, { compact: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
