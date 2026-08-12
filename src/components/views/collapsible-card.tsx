"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCollapsibleState } from "@/hooks/use-dashboard-settings";

interface CollapsibleCardProps {
  sectionKey: string;
  title?: React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  contentClassName?: string;
}

/**
 * A Card with a collapsible header. The open/closed state persists to localStorage
 * via the useCollapsibleState hook.
 */
export function CollapsibleCard({
  sectionKey,
  title,
  description,
  icon,
  actions,
  children,
  className,
  defaultOpen = true,
  contentClassName,
}: CollapsibleCardProps) {
  const { isOpen, toggle } = useCollapsibleState(sectionKey, defaultOpen);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader
        className={cn(
          "flex flex-row items-center justify-between pb-3 transition-colors cursor-pointer select-none",
          isOpen && "border-b border-border",
        )}
        onClick={toggle}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon}
          <div className="min-w-0">
            {title && <CardTitle className="text-sm font-semibold">{title}</CardTitle>}
            {description && <CardDescription className="text-xs">{description}</CardDescription>}
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {actions}
          <button
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform duration-200", isOpen ? "" : "-rotate-90")}
            />
          </button>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className={cn("pt-3 animate-slide-down", contentClassName)}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}
