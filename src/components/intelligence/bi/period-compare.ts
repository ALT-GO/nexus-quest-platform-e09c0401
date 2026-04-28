/**
 * Helpers to compute period comparisons.
 * Given a date range and a list of items with date getters, returns counts
 * for the current period and the previous comparable period.
 */

import { differenceInMilliseconds } from "date-fns";

export interface PeriodCompareInput<T> {
  items: T[];
  getDate: (item: T) => Date | null | undefined;
  dateRange: { start: Date; end: Date };
}

export function previousPeriod(dateRange: { start: Date; end: Date }) {
  const ms = differenceInMilliseconds(dateRange.end, dateRange.start);
  const prevEnd = new Date(dateRange.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - ms);
  return { start: prevStart, end: prevEnd };
}

export function countInRange<T>({ items, getDate, dateRange }: PeriodCompareInput<T>): number {
  const startMs = dateRange.start.getTime();
  const endMs = dateRange.end.getTime();
  let n = 0;
  for (const it of items) {
    const d = getDate(it);
    if (!d) continue;
    const t = new Date(d).getTime();
    if (t >= startMs && t <= endMs) n++;
  }
  return n;
}

/** Convenience: returns { current, previous } counts. */
export function comparePeriod<T>(
  items: T[],
  getDate: (item: T) => Date | null | undefined,
  dateRange: { start: Date; end: Date },
) {
  const prev = previousPeriod(dateRange);
  return {
    current: countInRange({ items, getDate, dateRange }),
    previous: countInRange({ items, getDate, dateRange: prev }),
  };
}
