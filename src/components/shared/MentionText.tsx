import { Fragment } from "react";

interface MentionTextProps {
  text: string;
  memberNames: string[];
}

/**
 * Renders text with @mentions highlighted in primary color.
 * Matches the longest member name first to support multi-word names.
 */
export function MentionText({ text, memberNames }: MentionTextProps) {
  if (!text) return null;
  if (!memberNames.length) return <>{text}</>;

  // Sort names desc by length so "@João Silva" wins over "@João"
  const sorted = [...memberNames].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`@(?:${escaped.join("|")})`, "g");

  const parts: Array<{ value: string; mention: boolean }> = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ value: text.slice(lastIdx, match.index), mention: false });
    }
    parts.push({ value: match[0], mention: true });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push({ value: text.slice(lastIdx), mention: false });
  }

  return (
    <>
      {parts.map((p, i) =>
        p.mention ? (
          <span key={i} className="text-primary font-medium">
            {p.value}
          </span>
        ) : (
          <Fragment key={i}>{p.value}</Fragment>
        )
      )}
    </>
  );
}
