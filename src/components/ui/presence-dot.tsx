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
  offline: "bg-muted-foreground",
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
        "inline-flex items-center justify-center rounded-full h-2.5 w-2.5 text-background",
        STATUS_CLASSES[derived],
        ringed && "ring-2 ring-background",
        className
      )}
    >
      {derived === "offline" && (
        <svg
          viewBox="0 0 8 8"
          className="h-full w-full"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M2.5 2.5 L5.5 5.5 M5.5 2.5 L2.5 5.5" />
        </svg>
      )}
    </span>
  );
}

export function usePresenceStatus(userId?: string | null): PresenceStatus {
  const map = usePresenceMap();
  if (!userId) return "offline";
  return derivePresenceStatus(map[userId]);
}
