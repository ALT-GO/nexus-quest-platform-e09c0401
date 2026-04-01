import React, { lazy, Suspense, useMemo } from "react";
import { icons, LucideProps } from "lucide-react";

interface Props extends LucideProps {
  name: string;
}

/**
 * Renders a Lucide icon by its kebab-case name.
 * Falls back to a colored dot if the icon name is not found.
 */
export function DynamicLucideIcon({ name, ...props }: Props) {
  const IconComponent = useMemo(() => {
    // Convert kebab-case to PascalCase
    const pascalName = name
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
    return (icons as any)[pascalName] || null;
  }, [name]);

  if (!IconComponent) {
    // If it looks like an emoji, render it directly
    if (/\p{Emoji}/u.test(name)) {
      return <span className="text-sm leading-none">{name}</span>;
    }
    return <span className="inline-block h-3 w-3 rounded-full bg-muted-foreground" />;
  }

  return <IconComponent {...props} />;
}
