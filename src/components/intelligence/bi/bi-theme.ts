/**
 * BI Theme — Unified visual tokens for the dashboard.
 * Stripe-inspired: soft gradients, subtle shadows, premium feel.
 * All colors come from CSS HSL tokens defined in index.css.
 */

export const BI_TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
  boxShadow: "0 8px 24px -8px hsl(var(--foreground) / 0.12)",
  fontSize: "12px",
  padding: "8px 12px",
} as const;

/** Categorical color palette — used for charts with multiple series/slices. */
export const BI_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--destructive))",
  "hsl(var(--chart-2))",
];

/** Semantic colors used across both modules. */
export const BI_SEMANTIC = {
  created: "hsl(var(--info))",
  completed: "hsl(var(--success))",
  pending: "hsl(var(--warning))",
  overdue: "hsl(var(--destructive))",
  primary: "hsl(var(--primary))",
  neutral: "hsl(var(--muted-foreground))",
} as const;

/**
 * Renders SVG <linearGradient> defs for use inside Recharts charts.
 * Use as <defs>{biGradientDefs(...ids)}</defs>.
 */
export const BI_GRADIENTS = {
  primary: { id: "bi-grad-primary", color: "hsl(var(--primary))" },
  success: { id: "bi-grad-success", color: "hsl(var(--success))" },
  info: { id: "bi-grad-info", color: "hsl(var(--info))" },
  warning: { id: "bi-grad-warning", color: "hsl(var(--warning))" },
  destructive: { id: "bi-grad-destructive", color: "hsl(var(--destructive))" },
  chart4: { id: "bi-grad-chart4", color: "hsl(var(--chart-4))" },
  chart5: { id: "bi-grad-chart5", color: "hsl(var(--chart-5))" },
} as const;

export type BIGradientKey = keyof typeof BI_GRADIENTS;

/** Format a number as a delta percentage like "+12%" / "-3%" / "0%". */
export function formatDeltaPercent(current: number, previous: number): {
  value: number;
  label: string;
  isPositive: boolean | null;
} {
  if (previous === 0 && current === 0) return { value: 0, label: "0%", isPositive: null };
  if (previous === 0) return { value: 100, label: "novo", isPositive: true };
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(delta);
  return {
    value: Math.abs(rounded),
    label: `${rounded > 0 ? "+" : ""}${rounded}%`,
    isPositive: rounded === 0 ? null : rounded > 0,
  };
}

/** Sub-tab keys used by both T.I. and Marketing modules to keep parity. */
export const BI_SUBTABS = [
  { key: "overview", label: "Visão Geral", icon: "LayoutDashboard" as const },
  { key: "productivity", label: "Produtividade", icon: "Users" as const },
  { key: "time", label: "Tempo & Backlog", icon: "Clock" as const },
  { key: "domain", label: "Domínio", icon: "Briefcase" as const }, // TI: Ativos & Custos | Marketing: Eventos & Metas
] as const;

export type BISubTab = (typeof BI_SUBTABS)[number]["key"];
