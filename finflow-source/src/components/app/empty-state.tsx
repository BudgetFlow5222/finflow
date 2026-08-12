"use client";

import * as React from "react";
import { Sparkles, Database, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  icon: Icon = Sparkles,
  title = "No data yet",
  description = "Get started by adding your first record or load demo data.",
  actionLabel = "Load demo data",
  onAction,
  variant = "default",
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "default" | "error";
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <div
          className={
            variant === "error"
              ? "mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400"
              : "mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          }
        >
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
        {onAction && actionLabel && (
          <Button onClick={onAction} size="sm" className="mt-4 gap-1.5" disabled={variant === "error"}>
            {variant === "default" ? <Database className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
