import { BI_GRADIENTS, type BIGradientKey } from "./bi-theme";

interface Props {
  /** Which gradients to render. Defaults to all. */
  keys?: BIGradientKey[];
  /** Top opacity (default 0.95) */
  fromOpacity?: number;
  /** Bottom opacity (default 0.15) */
  toOpacity?: number;
  /** Direction: "vertical" (top→bottom) or "horizontal" (left→right). Default vertical. */
  direction?: "vertical" | "horizontal";
}

/**
 * Renders <defs><linearGradient/></defs> for Recharts.
 * Reference the gradient with `fill="url(#bi-grad-primary)"` etc.
 */
export function BIGradientDefs({
  keys,
  fromOpacity = 0.95,
  toOpacity = 0.18,
  direction = "vertical",
}: Props) {
  const list = (keys ?? (Object.keys(BI_GRADIENTS) as BIGradientKey[])).map((k) => BI_GRADIENTS[k]);
  const x2 = direction === "horizontal" ? "1" : "0";
  const y2 = direction === "horizontal" ? "0" : "1";

  return (
    <defs>
      {list.map((g) => (
        <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2={x2} y2={y2}>
          <stop offset="5%" stopColor={g.color} stopOpacity={fromOpacity} />
          <stop offset="95%" stopColor={g.color} stopOpacity={toOpacity} />
        </linearGradient>
      ))}
    </defs>
  );
}
