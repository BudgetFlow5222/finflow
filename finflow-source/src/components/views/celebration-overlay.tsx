"use client";

import * as React from "react";
import { Trophy, Award, Sparkles, Share2, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Finance palette for confetti — emerald, teal, cyan, amber, violet, rose.
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = [
  "#10b981", // emerald-500
  "#14b8a6", // teal-500
  "#06b6d4", // cyan-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#f43f5e", // rose-500
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CelebrationMilestone =
  | "25%"
  | "50%"
  | "75%"
  | "100%"
  | "completed";

export interface CelebrationOverlayProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goalName: string;
  milestone: CelebrationMilestone;
  savedAmount: number;
  targetAmount: number;
}

interface ConfettiPiece {
  id: number;
  left: number; // vw %
  color: string;
  delay: number; // s
  duration: number; // s
  width: number; // px
  height: number; // px
  round: boolean;
  rotate: number; // deg
}

// ---------------------------------------------------------------------------
// Confetti generator — pure JS randomness. Memoised so pieces stay stable
// for the lifetime of one open-state.
// ---------------------------------------------------------------------------

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => {
    const round = Math.random() > 0.6;
    const size = 6 + Math.random() * 8;
    return {
      id: i,
      left: Math.random() * 100,
      color:
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 2.5,
      duration: 2.5 + Math.random() * 2,
      width: size,
      height: round ? size : size * (0.4 + Math.random() * 0.3),
      round,
      rotate: Math.random() * 360,
    };
  });
}

// ---------------------------------------------------------------------------
// Milestone visual config — gradient + icon + copy per threshold.
// ---------------------------------------------------------------------------

interface MilestoneConfig {
  title: string;
  subtitle: string;
  Icon: typeof Trophy;
  gradient: string; // tailwind gradient stops
}

function getMilestoneConfig(
  milestone: CelebrationMilestone,
): MilestoneConfig {
  switch (milestone) {
    case "completed":
    case "100%":
      return {
        title: "Congratulations!",
        subtitle: "Goal completed! 🎉",
        Icon: Trophy,
        gradient: "from-amber-500 via-orange-500 to-rose-500",
      };
    case "75%":
      return {
        title: "Milestone Reached!",
        subtitle: "Almost there!",
        Icon: Award,
        gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
      };
    case "50%":
      return {
        title: "Milestone Reached!",
        subtitle: "Halfway there!",
        Icon: Award,
        gradient: "from-emerald-500 via-teal-500 to-cyan-500",
      };
    case "25%":
    default:
      return {
        title: "Milestone Reached!",
        subtitle: "Great start!",
        Icon: Award,
        gradient: "from-cyan-500 via-sky-500 to-emerald-500",
      };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CelebrationOverlay({
  open,
  onOpenChange,
  goalName,
  milestone,
  savedAmount,
  targetAmount,
}: CelebrationOverlayProps) {
  // Bigger confetti burst when the goal is fully completed.
  const isCompleted = milestone === "completed" || milestone === "100%";

  // Regenerate confetti every time the dialog opens so each celebration
  // looks fresh. `open` toggling false→true triggers the memo.
  const confetti = React.useMemo<ConfettiPiece[]>(
    () => generateConfetti(isCompleted ? 80 : 50),
    [open, isCompleted],
  );

  const config = getMilestoneConfig(milestone);
  const { Icon } = config;

  // Actual progress percentage (clamped to 100) — may exceed the milestone
  // threshold if the user added a large amount that crossed multiple.
  const actualPct =
    targetAmount > 0
      ? Math.min(100, (savedAmount / targetAmount) * 100)
      : 0;
  const remaining = Math.max(0, targetAmount - savedAmount);

  // Progress ring geometry (matches the goals-view CircularProgress scale).
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - actualPct / 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Confetti layer — fixed full-screen, above the dialog, click-through */}
      {open && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
        >
          {confetti.map((p) => (
            <span
              key={p.id}
              style={{
                position: "absolute",
                top: 0,
                left: `${p.left}%`,
                width: `${p.width}px`,
                height: `${p.height}px`,
                backgroundColor: p.color,
                borderRadius: p.round ? "9999px" : "2px",
                transform: `translate3d(0, 0, 0) rotate(${p.rotate}deg)`,
                animation: `confetti-fall ${p.duration}s linear ${p.delay}s forwards`,
                willChange: "transform, opacity",
                opacity: 0.95,
              }}
            />
          ))}
        </div>
      )}

      <DialogContent
        showCloseButton={false}
        className={cn(
          // Reset shadcn dialog defaults we don't want
          "max-w-md gap-0 overflow-hidden border-0 p-0 text-white shadow-2xl",
          // Gradient background per milestone
          "bg-gradient-to-br",
          config.gradient,
          // Custom entry animation (overrides default zoom-in-95 via twMerge)
          "data-[state=open]:animate-[celebrate-pop_0.55s_cubic-bezier(0.34,1.56,0.64,1)]",
        )}
      >
        <DialogTitle className="sr-only">Goal celebration</DialogTitle>
        <DialogDescription className="sr-only">
          You have reached a savings goal milestone.
        </DialogDescription>

        {/* Decorative glow layers */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-white/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.18),transparent_60%)]" />

        <div className="relative px-6 pb-6 pt-8 text-center">
          {/* Ambient sparkles */}
          <Sparkles className="absolute left-6 top-6 h-5 w-5 animate-pulse text-white/70" />
          <Sparkles className="absolute right-8 top-10 h-4 w-4 animate-pulse text-white/50" />
          <Sparkles className="absolute bottom-16 left-8 h-3 w-3 animate-pulse text-white/40" />
          <Sparkles className="absolute bottom-10 right-6 h-4 w-4 animate-pulse text-white/50" />

          {/* Animated trophy / award icon */}
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 shadow-lg ring-4 ring-white/30 backdrop-blur-sm animate-[celebrate-bounce_1.2s_ease-in-out_infinite]">
            <Icon className="h-10 w-10 text-white drop-shadow" />
          </div>

          {/* Headline */}
          <h2 className="text-2xl font-bold tracking-tight drop-shadow-sm">
            {config.title}
          </h2>
          <p className="mt-1 text-sm font-medium text-white/90">
            {config.subtitle}
          </p>

          {/* Goal + milestone copy */}
          <p className="mt-4 text-base font-semibold leading-snug">
            {isCompleted
              ? `You've completed your “${goalName}” goal!`
              : `You've reached ${milestone} of your “${goalName}” goal!`}
          </p>

          {/* Progress ring */}
          <div className="mt-5 flex items-center justify-center">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg
                className="h-32 w-32 -rotate-90"
                viewBox="0 0 128 128"
                aria-hidden
              >
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="8"
                />
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  stroke="white"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className="transition-all duration-1000 ease-out"
                  style={{
                    filter: "drop-shadow(0 0 6px rgba(255,255,255,0.6))",
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular">
                  {actualPct.toFixed(0)}%
                </span>
                <span className="text-[10px] uppercase tracking-wider text-white/80">
                  Complete
                </span>
              </div>
            </div>
          </div>

          {/* Numbers row */}
          <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg bg-white/10 p-3 text-xs backdrop-blur-sm">
            <div>
              <p className="text-white/70">Saved</p>
              <p className="font-bold tabular">{formatCurrency(savedAmount)}</p>
            </div>
            <div className="border-x border-white/20">
              <p className="text-white/70">Target</p>
              <p className="font-bold tabular">
                {formatCurrency(targetAmount)}
              </p>
            </div>
            <div>
              <p className="text-white/70">Remaining</p>
              <p className="font-bold tabular">{formatCurrency(remaining)}</p>
            </div>
          </div>

          {/* Encouraging message with real numbers */}
          <p className="mt-4 text-xs leading-relaxed text-white/85">
            {isCompleted
              ? "Outstanding work — every rupee counted. Consider setting a new goal to keep the momentum going!"
              : remaining > 0
                ? `Keep going — only ${formatCurrency(remaining)} to go to hit your target!`
                : "You've reached your target!"}
          </p>

          {/* Action buttons */}
          <div className="mt-6 flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-1.5 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              onClick={() => toast.info("Sharing coming soon!")}
            >
              <Share2 className="h-4 w-4" /> Share
            </Button>
            <Button
              className="flex-[1.5] gap-1.5 bg-white text-slate-900 shadow-md hover:bg-white/90"
              onClick={() => onOpenChange(false)}
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
