import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
  /** Right-side hint, e.g. "últimos 30 dias" or summary value. */
  hint?: ReactNode;
  /** Right-side action, e.g. a button or filter. */
  action?: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Default content padding. Set false to remove for full-bleed (e.g. tables). */
  padded?: boolean;
}

/**
 * Standard BI chart card. Provides consistent header, spacing, gradient halo on hover.
 */
export function BIChartCard({
  title,
  icon: Icon,
  iconColor = "text-muted-foreground",
  hint,
  action,
  description,
  children,
  className,
  padded = true,
}: Props) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/60 bg-gradient-to-br from-card to-card/60 shadow-sm transition-all hover:shadow-md hover:border-primary/20",
        className,
      )}
    >
      {/* Subtle top accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {Icon && (
            <div className={cn("flex h-7 w-7 items-center justify-center rounded-md bg-muted/60", iconColor)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
          )}
          <span className="truncate">{title}</span>
          <div className="ml-auto flex items-center gap-2">
            {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
            {action}
          </div>
        </CardTitle>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className={cn(padded ? "" : "p-0")}>{children}</CardContent>
    </Card>
  );
}
