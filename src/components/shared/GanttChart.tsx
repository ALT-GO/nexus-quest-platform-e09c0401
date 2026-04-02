import { useMemo, useRef, useState, useEffect, useCallback } from "react";
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

const SIDEBAR_WIDTH = 320;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 56;

export function GanttChart({ items, onItemClick }: GanttChartProps) {
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const dayWidth = zoomConfig[zoom].dayWidth;

  // Calculate date range
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

  // Scroll to today on mount
  useEffect(() => {
    if (timelineScrollRef.current) {
      const todayOffset = differenceInDays(startOfDay(new Date()), rangeStart);
      const scrollTo = todayOffset * dayWidth - 300;
      timelineScrollRef.current.scrollLeft = Math.max(0, scrollTo);
    }
  }, [rangeStart, dayWidth]);

  // Sync horizontal scroll from the timeline header to the body and vice-versa
  const syncingRef = useRef(false);
  const handleTimelineHeaderScroll = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (timelineScrollRef.current && bodyScrollRef.current) {
      bodyScrollRef.current.scrollLeft = timelineScrollRef.current.scrollLeft;
    }
    syncingRef.current = false;
  }, []);

  const handleBodyScroll = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (bodyScrollRef.current && timelineScrollRef.current) {
      timelineScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
    }
    syncingRef.current = false;
  }, []);

  // Generate day columns
  const days = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));
  }, [rangeStart, totalDays]);

  // Group items
  const groups = useMemo(() => {
    const map = new Map<string, GanttItem[]>();
    items.forEach((item) => {
      const g = item.group || "Sem grupo";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    });
    return Array.from(map.entries());
  }, [items]);

  // Flatten for rendering
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

  const cycleZoom = (dir: "in" | "out") => {
    const levels: ZoomLevel[] = ["month", "week", "day"];
    const idx = levels.indexOf(zoom);
    if (dir === "in" && idx < levels.length - 1) setZoom(levels[idx + 1]);
    if (dir === "out" && idx > 0) setZoom(levels[idx - 1]);
  };

  const scrollToToday = () => {
    const scrollTo = todayOffset * dayWidth - 300;
    if (timelineScrollRef.current) {
      timelineScrollRef.current.scrollTo({ left: Math.max(0, scrollTo), behavior: "smooth" });
    }
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTo({ left: Math.max(0, scrollTo), behavior: "smooth" });
    }
  };

  const timelineWidth = totalDays * dayWidth;

  return (
    <TooltipProvider>
      <div className="flex flex-col border rounded-xl bg-card overflow-hidden h-[calc(100vh-280px)]">
        {/* Toolbar */}
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

        {/* Sticky header row */}
        <div className="flex shrink-0 border-b" style={{ height: HEADER_HEIGHT }}>
          {/* Sidebar header */}
          <div
            className="shrink-0 flex items-center px-3 bg-muted/50 font-medium text-xs text-muted-foreground border-r"
            style={{ width: SIDEBAR_WIDTH }}
          >
            Nome
          </div>
          {/* Timeline header - horizontal scroll only */}
          <div
            ref={timelineScrollRef}
            className="flex-1 overflow-x-auto overflow-y-hidden"
            onScroll={handleTimelineHeaderScroll}
            style={{ scrollbarWidth: "none" }}
          >
            <div className="flex bg-muted/50" style={{ width: timelineWidth }}>
              {days.map((day, i) => {
                const isWeekStart = day.getDay() === 1;
                const isMonthStart = day.getDate() === 1;
                const today = isToday(day);
                return (
                  <div
                    key={i}
                    className={cn(
                      "shrink-0 flex flex-col items-center justify-center border-r text-[10px]",
                      isWeekend(day) && "bg-muted/40",
                      today && "bg-primary/5"
                    )}
                    style={{ width: dayWidth, height: HEADER_HEIGHT }}
                  >
                    {(zoom === "day" || isWeekStart || isMonthStart) && (
                      <>
                        <span className="text-muted-foreground font-medium uppercase">
                          {format(day, "EEE", { locale: ptBR })}
                        </span>
                        <span className={cn(
                          "font-bold",
                          today ? "bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]" : "text-foreground"
                        )}>
                          {format(day, "d")}
                        </span>
                      </>
                    )}
                    {zoom !== "day" && !isWeekStart && !isMonthStart && (
                      <span className="text-muted-foreground/50">{format(day, "d")}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Body: single scroll container for both sidebar rows and timeline bars */}
        <div
          ref={bodyScrollRef}
          className="flex-1 overflow-auto"
          onScroll={handleBodyScroll}
        >
          <div style={{ width: SIDEBAR_WIDTH + timelineWidth, minHeight: rows.length * ROW_HEIGHT }}>
            {rows.map((row, rowIndex) => {
              const top = rowIndex * ROW_HEIGHT;

              if (row.type === "group") {
                return (
                  <div
                    key={`row-${rowIndex}`}
                    className="flex border-b"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Sidebar group */}
                    <div
                      className="shrink-0 flex items-center gap-2 px-3 bg-muted/20 font-semibold text-sm sticky left-0 z-10 border-r"
                      style={{ width: SIDEBAR_WIDTH }}
                    >
                      <span className="text-foreground">{row.label}</span>
                      <span className="text-xs text-muted-foreground font-normal">{row.count}</span>
                    </div>
                    {/* Timeline group row */}
                    <div className="bg-muted/20" style={{ width: timelineWidth, height: ROW_HEIGHT }} />
                  </div>
                );
              }

              const item = row.item;
              const bar = getBarPosition(item);
              const color = getBarColor(item);
              const completed = isCompleted(item);

              return (
                <div
                  key={item.id}
                  className="flex border-b"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Sidebar item - sticky left */}
                  <div
                    className="shrink-0 flex items-center gap-2 px-3 hover:bg-muted/30 cursor-pointer transition-colors sticky left-0 z-10 bg-card border-r"
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
                        className="h-5 w-5 shrink-0"
                        fallbackClassName="text-[8px]"
                      />
                    )}
                    <span className={cn(
                      "text-sm truncate flex-1",
                      completed && "line-through text-muted-foreground"
                    )}>
                      {item.title}
                    </span>
                  </div>

                  {/* Timeline bar area */}
                  <div className="relative" style={{ width: timelineWidth, height: ROW_HEIGHT }}>
                    {/* Weekend striping */}
                    {days.map((day, di) =>
                      isWeekend(day) ? (
                        <div
                          key={di}
                          className="absolute top-0 bottom-0 bg-muted/20"
                          style={{ left: di * dayWidth, width: dayWidth }}
                        />
                      ) : null
                    )}

                    {/* Bar */}
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

                    {/* No-date dot */}
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

                    {/* Today line */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-destructive z-20 pointer-events-none"
                      style={{ left: todayOffset * dayWidth + dayWidth / 2 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
