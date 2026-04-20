import { useMemo, useRef, useState, useEffect } from "react";
import { format, addDays, differenceInDays, startOfDay, startOfWeek, endOfWeek, isToday, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

export interface GanttItem {
  id: string;
  title: string;
  group?: string;
  startDate: string | null;
  endDate: string | null;
  progress?: string;
  priority?: string;
  assigneeName?: string;
  assigneeAvatarUrl?: string;
  assigneeId?: string;
  color?: string;
}

interface GanttChartProps {
  items: GanttItem[];
  onItemClick?: (id: string) => void;
}

type ZoomLevel = "day" | "week" | "month";

const zoomConfig: Record<ZoomLevel, { dayWidth: number; label: string }> = {
  day: { dayWidth: 60, label: "Dia" },
  week: { dayWidth: 30, label: "Semana" },
  month: { dayWidth: 12, label: "Mês" },
};

const priorityColors: Record<string, string> = {
  high: "0 84% 60%",
  medium: "38 92% 50%",
  low: "199 89% 48%",
};

function getBarColor(item: GanttItem): string {
  if (item.color) return item.color;
  if (item.priority && priorityColors[item.priority]) return priorityColors[item.priority];
  return "262 83% 58%";
}

function isCompleted(item: GanttItem): boolean {
  const p = item.progress?.toLowerCase() || "";
  return p === "concluído" || p === "completed" || p === "done";
}

export function GanttChart({ items, onItemClick }: GanttChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const dayWidth = zoomConfig[zoom].dayWidth;
  const SIDEBAR_WIDTH = 320;
  const ROW_HEIGHT = 40;
  const HEADER_HEIGHT = 56;

  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    const today = startOfDay(new Date());
    let minDate = today;
    let maxDate = addDays(today, 30);

    items.forEach((item) => {
      if (item.startDate) {
        const s = startOfDay(new Date(item.startDate));
        if (s < minDate) minDate = s;
      }
      if (item.endDate) {
        const e = startOfDay(new Date(item.endDate));
        if (e > maxDate) maxDate = e;
      }
    });

    const start = addDays(startOfWeek(minDate, { locale: ptBR }), -7);
    const end = addDays(endOfWeek(maxDate, { locale: ptBR }), 14);
    return {
      rangeStart: start,
      rangeEnd: end,
      totalDays: differenceInDays(end, start) + 1,
    };
  }, [items]);

  useEffect(() => {
    if (scrollRef.current) {
      const todayOffset = differenceInDays(startOfDay(new Date()), rangeStart);
      const scrollTo = todayOffset * dayWidth - 300;
      scrollRef.current.scrollLeft = Math.max(0, scrollTo);
    }
  }, [rangeStart, dayWidth]);

  const days = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));
  }, [rangeStart, totalDays]);

  const groups = useMemo(() => {
    const map = new Map<string, GanttItem[]>();
    items.forEach((item) => {
      const g = item.group || "Sem grupo";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    });
    return Array.from(map.entries());
  }, [items]);

  const rows = useMemo(() => {
    const flat: Array<{ type: "group"; label: string; count: number } | { type: "item"; item: GanttItem }> = [];
    groups.forEach(([label, groupItems]) => {
      if (groups.length > 1 || label !== "Sem grupo") {
        flat.push({ type: "group", label, count: groupItems.length });
      }
      groupItems.forEach((item) => flat.push({ type: "item", item }));
    });
    return flat;
  }, [groups]);

  const getBarPosition = (item: GanttItem) => {
    if (!item.startDate) return null;
    const start = startOfDay(new Date(item.startDate));
    const end = item.endDate ? startOfDay(new Date(item.endDate)) : start;
    const leftDays = differenceInDays(start, rangeStart);
    const widthDays = Math.max(differenceInDays(end, start) + 1, 1);
    return {
      left: leftDays * dayWidth,
      width: widthDays * dayWidth - 4,
    };
  };

  const todayOffset = differenceInDays(startOfDay(new Date()), rangeStart);
  const timelineWidth = totalDays * dayWidth;

  const cycleZoom = (dir: "in" | "out") => {
    const levels: ZoomLevel[] = ["month", "week", "day"];
    const idx = levels.indexOf(zoom);
    if (dir === "in" && idx < levels.length - 1) setZoom(levels[idx + 1]);
    if (dir === "out" && idx > 0) setZoom(levels[idx - 1]);
  };

  const scrollToToday = () => {
    if (scrollRef.current) {
      const scrollTo = todayOffset * dayWidth - 300;
      scrollRef.current.scrollTo({ left: Math.max(0, scrollTo), behavior: "smooth" });
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col border rounded-xl bg-card overflow-hidden h-[calc(100vh-280px)]">
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={scrollToToday}>
            Hoje
          </Button>
          <div className="flex items-center border rounded-md">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => cycleZoom("out")}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 text-xs font-medium text-muted-foreground">{zoomConfig[zoom].label}</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => cycleZoom("in")}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {items.length} {items.length === 1 ? "tarefa" : "tarefas"}
          </span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div
            className="relative"
            style={{
              width: SIDEBAR_WIDTH + timelineWidth,
              minHeight: HEADER_HEIGHT + rows.length * ROW_HEIGHT,
            }}
          >
            <div className="sticky top-0 z-30 flex border-b bg-card" style={{ height: HEADER_HEIGHT }}>
              <div
                className="sticky left-0 z-40 flex items-center px-3 border-r bg-muted/50 font-medium text-xs text-muted-foreground"
                style={{ width: SIDEBAR_WIDTH }}
              >
                Nome
              </div>
              <div className="flex bg-muted/50" style={{ width: timelineWidth }}>
                {days.map((day, i) => {
                  const isWeekStart = day.getDay() === 1;
                  const isMonthStart = day.getDate() === 1;
                  const today = isToday(day);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "shrink-0 flex flex-col items-center justify-center border-r overflow-hidden text-[10px]",
                        isWeekend(day) && "bg-muted/40",
                        today && "bg-primary/5"
                      )}
                      style={{ width: dayWidth }}
                    >
                      {(zoom === "day" || ((isWeekStart || isMonthStart) && dayWidth >= 20)) && (
                        <>
                          {dayWidth >= 28 && (
                            <span className="text-muted-foreground font-medium uppercase leading-none truncate max-w-full">
                              {format(day, dayWidth >= 50 ? "EEE" : "EEEEE", { locale: ptBR })}
                            </span>
                          )}
                          <span
                            className={cn(
                              "font-bold leading-none",
                              today
                                ? "bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                                : "text-foreground"
                            )}
                          >
                            {format(day, "d")}
                          </span>
                        </>
                      )}
                      {zoom !== "day" && !isWeekStart && !isMonthStart && dayWidth >= 14 && (
                        <span className="text-muted-foreground/50 leading-none">{format(day, "d")}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              {rows.map((row, rowIndex) => {
                if (row.type === "group") {
                  return (
                    <div key={`g-${rowIndex}`} className="flex border-b" style={{ height: ROW_HEIGHT }}>
                      <div
                        className="sticky left-0 z-20 flex items-center gap-2 px-3 bg-muted/20 border-r font-semibold text-sm"
                        style={{ width: SIDEBAR_WIDTH }}
                      >
                        <span className="text-foreground">{row.label}</span>
                        <span className="text-xs text-muted-foreground font-normal">{row.count}</span>
                      </div>
                      <div className="bg-muted/20" style={{ width: timelineWidth }} />
                    </div>
                  );
                }

                const item = row.item;
                const bar = getBarPosition(item);
                const color = getBarColor(item);
                const completed = isCompleted(item);

                return (
                  <div key={item.id} className="flex border-b" style={{ height: ROW_HEIGHT }}>
                    <div
                      className="sticky left-0 z-20 flex items-center gap-2 px-3 border-r bg-card hover:bg-muted/30 cursor-pointer transition-colors"
                      style={{ width: SIDEBAR_WIDTH }}
                      onClick={() => onItemClick?.(item.id)}
                    >
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: `hsl(${color})` }}
                      />
                      {item.assigneeName && (
                        <UserAvatar
                          name={item.assigneeName}
                          avatarUrl={item.assigneeAvatarUrl}
                          userId={item.assigneeId}
                          className="h-5 w-5 shrink-0"
                          fallbackClassName="text-[8px]"
                        />
                      )}
                      <span
                        className={cn(
                          "text-sm truncate flex-1",
                          completed && "line-through text-muted-foreground"
                        )}
                      >
                        {item.title}
                      </span>
                    </div>

                    <div className="relative" style={{ width: timelineWidth, height: ROW_HEIGHT }}>
                      {days.map((day, di) =>
                        isWeekend(day) ? (
                          <div
                            key={di}
                            className="absolute top-0 bottom-0 bg-muted/20"
                            style={{ left: di * dayWidth, width: dayWidth }}
                          />
                        ) : null
                      )}

                      {bar && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "absolute top-[8px] rounded-md cursor-pointer transition-all hover:brightness-110 hover:shadow-md",
                                completed && "opacity-50"
                              )}
                              style={{
                                left: bar.left + 2,
                                width: Math.max(bar.width, 8),
                                height: ROW_HEIGHT - 16,
                                backgroundColor: `hsl(${color})`,
                              }}
                              onClick={() => onItemClick?.(item.id)}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-semibold">{item.title}</p>
                            {item.startDate && (
                              <p className="text-muted-foreground">
                                {format(new Date(item.startDate), "dd/MM")}
                                {item.endDate && ` → ${format(new Date(item.endDate), "dd/MM")}`}
                              </p>
                            )}
                            {item.assigneeName && <p>{item.assigneeName}</p>}
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {!bar && (
                        <div
                          className="absolute top-[14px] rounded-full"
                          style={{
                            left: todayOffset * dayWidth + dayWidth / 2 - 4,
                            width: 8,
                            height: 8,
                            backgroundColor: `hsl(${color} / 0.4)`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              <div
                className="absolute bottom-0 w-px bg-destructive z-20 pointer-events-none"
                style={{
                  top: 0,
                  left: SIDEBAR_WIDTH + todayOffset * dayWidth + dayWidth / 2,
                }}
              >
                <div className="absolute top-0 -translate-x-1/2 bg-destructive text-white text-[9px] font-bold px-1 rounded-b">
                  Hoje
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
