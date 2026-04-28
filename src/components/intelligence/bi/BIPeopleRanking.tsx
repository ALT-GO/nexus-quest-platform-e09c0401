import { Users } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Progress } from "@/components/ui/progress";
import { BIChartCard } from "./BIChartCard";
import { cn } from "@/lib/utils";

export interface PersonRow {
  name: string;
  userId?: string | null;
  avatarUrl?: string | null;
  total: number;
  completed: number;
}

interface Props {
  title?: string;
  people: PersonRow[];
  /** Singular noun for items, e.g. "chamado" or "tarefa". */
  entityNoun?: string;
  onPersonClick?: (name: string) => void;
}

/**
 * Standardized "people ranking" used in both T.I. and Marketing for parity.
 */
export function BIPeopleRanking({
  title = "Ranking por Pessoa",
  people,
  entityNoun = "item",
  onPersonClick,
}: Props) {
  const sorted = [...people].sort((a, b) => b.total - a.total);

  return (
    <BIChartCard
      title={title}
      icon={Users}
      iconColor="text-info"
      description={`Volume e taxa de conclusão por responsável`}
    >
      {sorted.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Sem {entityNoun}s atribuídos no período.
        </p>
      ) : (
        <div className="space-y-3">
          {sorted.map((p) => {
            const rate = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
            return (
              <div
                key={p.name}
                onClick={() => onPersonClick?.(p.name)}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-2 transition-colors",
                  onPersonClick && "cursor-pointer hover:bg-muted/40",
                )}
              >
                <UserAvatar
                  name={p.name}
                  avatarUrl={p.avatarUrl}
                  userId={p.userId}
                  className="h-8 w-8 shrink-0"
                  fallbackClassName="text-[10px]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{p.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {p.completed}/{p.total} <span className="text-success">({rate}%)</span>
                    </span>
                  </div>
                  <Progress value={rate} className="mt-1.5 h-1.5" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BIChartCard>
  );
}
