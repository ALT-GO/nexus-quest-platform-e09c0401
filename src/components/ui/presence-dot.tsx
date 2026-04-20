import { cn } from "@/lib/utils";
import { usePresenceMap, derivePresenceStatus, type PresenceStatus } from "@/hooks/use-presence";

interface PresenceDotProps {
  userId?: string | null;
  /** Override status directly (skips lookup) */
  status?: PresenceStatus;
  /** Tailwind size class for the dot — default h-2.5 w-2.5 */
  className?: string;
  /** Whether to show a ring around the dot (for stacking on avatars) */
  ringed?: boolean;
}

const STATUS_CLASSES: Record<PresenceStatus, string> = {
  online: "bg-success",
  away: "bg-warning",
  offline: "bg-muted-foreground/40",
};

const STATUS_LABEL: Record<PresenceStatus, string> = {
  online: "Online",
  away: "Ausente",
  offline: "Offline",
};

export function PresenceDot({ userId, status, className, ringed = true }: PresenceDotProps) {
  const map = usePresenceMap();
  const derived: PresenceStatus = status ?? derivePresenceStatus(userId ? map[userId] : null);

  return (
    <span
      title={STATUS_LABEL[derived]}
      aria-label={STATUS_LABEL[derived]}
      className={cn(
        "inline-block rounded-full h-2.5 w-2.5",
        STATUS_CLASSES[derived],
        ringed && "ring-2 ring-background",
        className
      )}
    />
  );
}

export function usePresenceStatus(userId?: string | null): PresenceStatus {
  const map = usePresenceMap();
  if (!userId) return "offline";
  return derivePresenceStatus(map[userId]);
}
