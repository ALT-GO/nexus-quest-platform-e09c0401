// Recurrence helpers — supports legacy (daily/weekly/monthly) and Teams-style
// custom rules serialized as `custom:{json}` in `recurrence_rule`.

export type RecurrenceUnit = "day" | "week" | "month" | "year";

export interface CustomRecurrence {
  /** Repeat every N units */
  interval: number;
  /** Time unit */
  unit: RecurrenceUnit;
  /** Days of the week (0=Sun..6=Sat). Used when unit === "week". */
  weekdays?: number[];
  /** Day of the month (1-31). Used when unit === "month". */
  monthDay?: number;
  /** Month of the year (1-12). Used when unit === "year". */
  yearMonth?: number;
}

export type ParsedRecurrence =
  | { kind: "preset"; preset: "daily" | "weekly" | "monthly" | "yearly" | "weekdays" }
  | { kind: "custom"; config: CustomRecurrence };

const DEFAULT_CUSTOM: CustomRecurrence = { interval: 1, unit: "week", weekdays: [1] };

export function parseRule(rule: string | null | undefined): ParsedRecurrence {
  if (!rule) return { kind: "preset", preset: "weekly" };
  if (rule === "daily" || rule === "weekly" || rule === "monthly" || rule === "yearly" || rule === "weekdays") {
    return { kind: "preset", preset: rule };
  }
  if (rule.startsWith("custom:")) {
    try {
      const json = rule.slice(7);
      const cfg = JSON.parse(json) as Partial<CustomRecurrence>;
      return {
        kind: "custom",
        config: {
          interval: Math.max(1, Number(cfg.interval) || 1),
          unit: (cfg.unit as RecurrenceUnit) || "week",
          weekdays: Array.isArray(cfg.weekdays) ? cfg.weekdays.map(Number).filter((d) => d >= 0 && d <= 6) : undefined,
          monthDay: cfg.monthDay ? Math.min(31, Math.max(1, Number(cfg.monthDay))) : undefined,
          yearMonth: cfg.yearMonth ? Math.min(12, Math.max(1, Number(cfg.yearMonth))) : undefined,
        },
      };
    } catch {
      return { kind: "preset", preset: "weekly" };
    }
  }
  return { kind: "preset", preset: "weekly" };
}

export function serializeCustom(config: CustomRecurrence): string {
  const clean: CustomRecurrence = {
    interval: Math.max(1, config.interval || 1),
    unit: config.unit,
  };
  if (config.unit === "week" && config.weekdays?.length) clean.weekdays = [...config.weekdays].sort();
  if (config.unit === "month" && config.monthDay) clean.monthDay = config.monthDay;
  if (config.unit === "year") {
    if (config.monthDay) clean.monthDay = config.monthDay;
    if (config.yearMonth) clean.yearMonth = config.yearMonth;
  }
  return `custom:${JSON.stringify(clean)}`;
}

/** Compute the next occurrence after `from` for a given rule. */
export function computeNextDate(from: Date, rule: string): Date {
  const parsed = parseRule(rule);
  const base = new Date(from);

  if (parsed.kind === "preset") {
    const next = new Date(base);
    switch (parsed.preset) {
      case "daily":
        next.setDate(next.getDate() + 1);
        return next;
      case "weekly":
        next.setDate(next.getDate() + 7);
        return next;
      case "monthly":
        next.setMonth(next.getMonth() + 1);
        return next;
      case "yearly":
        next.setFullYear(next.getFullYear() + 1);
        return next;
      case "weekdays": {
        // Next weekday Mon-Fri
        do {
          next.setDate(next.getDate() + 1);
        } while (next.getDay() === 0 || next.getDay() === 6);
        return next;
      }
    }
  }

  const cfg = parsed.config;
  const next = new Date(base);

  switch (cfg.unit) {
    case "day":
      next.setDate(next.getDate() + cfg.interval);
      return next;
    case "week": {
      const wd = cfg.weekdays?.length ? [...cfg.weekdays].sort() : [base.getDay()];
      // Advance day-by-day until we land on the next selected weekday;
      // if we cross past the current week, jump (interval-1) weeks ahead.
      const startDay = base.getDay();
      const sameWeekFuture = wd.find((d) => d > startDay);
      if (sameWeekFuture !== undefined) {
        next.setDate(next.getDate() + (sameWeekFuture - startDay));
        return next;
      }
      // Otherwise jump to first selected weekday of week +interval
      const daysToSunday = 7 - startDay;
      next.setDate(next.getDate() + daysToSunday + (cfg.interval - 1) * 7 + wd[0]);
      return next;
    }
    case "month": {
      const day = cfg.monthDay || base.getDate();
      next.setMonth(next.getMonth() + cfg.interval);
      // Clamp day to last day of target month
      const target = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, target));
      return next;
    }
    case "year": {
      const month = cfg.yearMonth ? cfg.yearMonth - 1 : base.getMonth();
      const day = cfg.monthDay || base.getDate();
      next.setFullYear(next.getFullYear() + cfg.interval);
      next.setMonth(month);
      const target = new Date(next.getFullYear(), month + 1, 0).getDate();
      next.setDate(Math.min(day, target));
      return next;
    }
  }
}

const WEEKDAY_NAMES_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/** Human-readable summary in PT-BR. */
export function describeRule(rule: string | null | undefined): string {
  if (!rule) return "—";
  const parsed = parseRule(rule);
  if (parsed.kind === "preset") {
    switch (parsed.preset) {
      case "daily": return "Diária";
      case "weekly": return "Semanal";
      case "monthly": return "Mensal";
      case "yearly": return "Anual";
      case "weekdays": return "Dias úteis (seg–sex)";
    }
  }
  const c = parsed.config;
  const every = c.interval === 1 ? "" : `a cada ${c.interval} `;
  switch (c.unit) {
    case "day":
      return c.interval === 1 ? "Todo dia" : `A cada ${c.interval} dias`;
    case "week": {
      const wd = c.weekdays?.length
        ? c.weekdays.map((d) => WEEKDAY_NAMES_PT[d]).join(", ")
        : "—";
      return c.interval === 1
        ? `Toda semana — ${wd}`
        : `A cada ${c.interval} semanas — ${wd}`;
    }
    case "month": {
      const day = c.monthDay ? `dia ${c.monthDay}` : "no mesmo dia";
      return c.interval === 1 ? `Todo mês ${day}` : `A cada ${c.interval} meses ${day}`;
    }
    case "year": {
      const m = c.yearMonth ? MONTH_NAMES_PT[c.yearMonth - 1] : "";
      const d = c.monthDay ? `dia ${c.monthDay}` : "";
      const tail = [d, m].filter(Boolean).join(" de ");
      return c.interval === 1 ? `Todo ano${tail ? ` em ${tail}` : ""}` : `A cada ${c.interval} anos${tail ? ` em ${tail}` : ""}`;
    }
  }
}
