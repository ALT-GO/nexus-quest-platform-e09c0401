import { useMemo } from "react";
import { Layers } from "lucide-react";
import { differenceInDays } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { BIChartCard } from "./BIChartCard";
import { BI_TOOLTIP_STYLE } from "./bi-theme";
import { BIGradientDefs } from "./BIGradientDefs";

interface Props {
  title?: string;
  /** Open items to bucket by age. */
  openItems: any[];
  getCreatedDate: (item: any) => Date | null | undefined;
  entityNoun?: string;
  onBucketClick?: (bucketLabel: string, items: any[]) => void;
}

const BUCKETS = [
  { label: "< 1d", min: 0, max: 1, gradient: "url(#bi-grad-success)" },
  { label: "1-3d", min: 1, max: 3, gradient: "url(#bi-grad-info)" },
  { label: "3-7d", min: 3, max: 7, gradient: "url(#bi-grad-primary)" },
  { label: "7-14d", min: 7, max: 14, gradient: "url(#bi-grad-warning)" },
  { label: "> 14d", min: 14, max: Infinity, gradient: "url(#bi-grad-destructive)" },
];

/**
 * Aging chart — distribution of currently-open items by how long they've been open.
 * Critical for the coordinator to spot stale work.
 */
export function BIBacklogAging({
  title = "Aging do Backlog",
  openItems,
  getCreatedDate,
  entityNoun = "item",
  onBucketClick,
}: Props) {
  const data = useMemo(() => {
    const now = new Date();
    const buckets = BUCKETS.map((b) => ({ ...b, items: [] as any[], count: 0 }));
    openItems.forEach((it) => {
      const d = getCreatedDate(it);
      if (!d) return;
      const age = differenceInDays(now, new Date(d));
      const idx = buckets.findIndex((b) => age >= b.min && age < b.max);
      if (idx >= 0) {
        buckets[idx].items.push(it);
        buckets[idx].count++;
      }
    });
    return buckets;
  }, [openItems, getCreatedDate]);

  const total = data.reduce((s, b) => s + b.count, 0);
  const stale = data.filter((b) => b.min >= 7).reduce((s, b) => s + b.count, 0);
  const stalePct = total > 0 ? Math.round((stale / total) * 100) : 0;

  const isClickable = !!onBucketClick;

  return (
    <BIChartCard
      title={title}
      icon={Layers}
      iconColor="text-warning"
      hint={
        total > 0 ? (
          <span>
            {total} aberto{total !== 1 ? "s" : ""} ·{" "}
            <span className={stalePct >= 30 ? "text-destructive font-semibold" : "text-warning font-semibold"}>
              {stalePct}% &gt; 7d
            </span>
          </span>
        ) : null
      }
      description={`Distribuição dos ${entityNoun}s atualmente abertos por tempo de espera`}
    >
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum {entityNoun} aberto 🎉
        </p>
      ) : (
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
              <BIGradientDefs keys={["success", "info", "primary", "warning", "destructive"]} />
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={BI_TOOLTIP_STYLE}
                cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                formatter={(v: number) => [`${v} ${entityNoun}${v !== 1 ? "s" : ""}`, "Quantidade"]}
              />
              <Bar
                dataKey="count"
                radius={[8, 8, 0, 0]}
                className={isClickable ? "cursor-pointer" : ""}
                onClick={(d: any) => isClickable && onBucketClick!(d.label, d.items)}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.gradient} />
                ))}
                <LabelList
                  dataKey="count"
                  position="top"
                  style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }}
                  formatter={(v: number) => (v > 0 ? v : "")}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </BIChartCard>
  );
}
