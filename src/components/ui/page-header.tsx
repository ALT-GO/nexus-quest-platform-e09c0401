import { cn } from "@/lib/utils";
import { GlobalTimerBadge } from "@/components/layout/GlobalTimerBadge";
import { NotificationCenter } from "@/components/layout/NotificationCenter";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 pb-4 sm:pb-6 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl md:text-3xl truncate">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <GlobalTimerBadge />
        {children}
        <NotificationCenter />
      </div>
    </div>
  );
}
