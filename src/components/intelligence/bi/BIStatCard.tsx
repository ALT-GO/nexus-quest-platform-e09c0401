import { LucideIcon, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDeltaPercent } from "./bi-theme";

interface Props {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  /** Color of the icon container (Tailwind class on text). */
  tone?: "primary" | "success" | "warning" | "destructive" | "info" | "neutral";
  description?: string;
  /** Current period numeric value (used to compute delta vs previous). */
  current?: number;
  /** Previous period numeric value (used to compute delta). */
  previous?: number;
  /** Whether an increase is good (true) or bad (false). Defaults to true. */
  higherIsBetter?: boolean;
  onClick?: () => void;
  className?: string;
}

const TONE_MAP: Record<NonNullable<Props["tone"]>, { bg: string; text: string }> = {
  primary: { bg: "bg-primary/10", text: "text-primary" },
  success: { bg: "bg-success/10", text: "text-success" },
  warning: { bg: "bg-warning/10", text: "text-warning" },
  destructive: { bg: "bg-destructive/10", text: "text-destructive" },
  info: { bg: "bg-info/10", text: "text-info" },
  neutral: { bg: "bg-muted", text: "text-muted-foreground" },
};

export function BIStatCard({
  title,
  value,
  icon: Icon,
  tone = "primary",
  description,
  current,
  previous,
  higherIsBetter = true,
  onClick,
  className,
}: Props) {
  const tones = TONE_MAP[tone];

  const showDelta = current !== undefined && previous !== undefined;
  const delta = showDelta ? formatDeltaPercent(current!, previous!) : null;

  // Determine trend semantic color
  let trendColor = "text-muted-foreground";
  let TrendIcon = Minus;
  if (delta && delta.isPositive !== null) {
    const isGood = higherIsBetter ? delta.isPositive : !delta.isPositive;
    trendColor = isGood ? "text-success" : "text-destructive";
    TrendIcon = delta.isPositive ? TrendingUp : TrendingDown;
  }

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card to-card/40 p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {/* Decorative gradient blob */}
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-60",
          tones.bg,
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              tones.bg,
              tones.text,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      {delta && (
        <div className="relative mt-3 flex items-center gap-1.5">
          <TrendIcon className={cn("h-3.5 w-3.5", trendColor)} />
          <span className={cn("text-xs font-semibold", trendColor)}>{delta.label}</span>
          <span className="text-xs text-muted-foreground">vs. período anterior</span>
        </div>
      )}
    </div>
  );
}
