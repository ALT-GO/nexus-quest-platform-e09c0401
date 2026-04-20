import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PresenceDot } from "@/components/ui/presence-dot";

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  /** When provided, renders a presence indicator dot for this user. */
  userId?: string | null;
  /** Hide presence indicator even if userId is provided. */
  hidePresence?: boolean;
  className?: string;
  fallbackClassName?: string;
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UserAvatar({
  name,
  avatarUrl,
  userId,
  hidePresence,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const showPresence = !!userId && !hidePresence;
  return (
    <span className="relative inline-block shrink-0">
      <Avatar className={cn("h-8 w-8", className)}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name || "Avatar"} />}
        <AvatarFallback className={cn("bg-primary/10 text-primary text-xs font-medium", fallbackClassName)}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      {showPresence && (
        <PresenceDot
          userId={userId}
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5"
        />
      )}
    </span>
  );
}
