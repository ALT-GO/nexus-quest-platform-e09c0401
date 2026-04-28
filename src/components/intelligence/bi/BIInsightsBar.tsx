import { AlertTriangle, TrendingDown, TrendingUp, Sparkles, Info, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type InsightTone = "positive" | "warning" | "danger" | "info";

export interface BIInsight {
  id: string;
  tone: InsightTone;
  title: string;
  description?: string;
  onClick?: () => void;
}

const TONE_STYLES: Record<InsightTone, { icon: typeof AlertTriangle; bg: string; ring: string; text: string }> = {
  positive: { icon: CheckCircle2, bg: "bg-success/8", ring: "ring-success/20", text: "text-success" },
  warning: { icon: TrendingDown, bg: "bg-warning/8", ring: "ring-warning/25", text: "text-warning" },
  danger: { icon: AlertTriangle, bg: "bg-destructive/8", ring: "ring-destructive/25", text: "text-destructive" },
  info: { icon: Info, bg: "bg-info/8", ring: "ring-info/20", text: "text-info" },
};

interface Props {
  insights: BIInsight[];
}

/**
 * Horizontal scrolling ribbon of automated alerts/insights.
 * Empty state shown if no insights present.
 */
export function BIInsightsBar({ insights }: Props) {
  if (insights.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary/60" />
        Nenhum alerta no momento. Os indicadores do período estão dentro do esperado.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-r from-card via-card to-card/60 p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Insights automáticos · {insights.length}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        {insights.map((it) => {
          const t = TONE_STYLES[it.tone];
          const Icon = t.icon;
          return (
            <button
              key={it.id}
              onClick={it.onClick}
              disabled={!it.onClick}
              className={cn(
                "flex min-w-[260px] max-w-[340px] shrink-0 items-start gap-2.5 rounded-lg p-2.5 text-left ring-1 transition-all",
                t.bg,
                t.ring,
                it.onClick ? "hover:ring-2 hover:scale-[1.01] cursor-pointer" : "cursor-default",
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", t.text)} />
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight">{it.title}</p>
                {it.description && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{it.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
