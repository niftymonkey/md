import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagBadgeProps {
  name: string;
  size?: "sm" | "md";
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
  asChild?: boolean;
}

const BASE =
  "border bg-[color-mix(in_oklch,var(--ochre)_8%,var(--paper))] text-[var(--ochre-deep)] border-[color-mix(in_oklch,var(--ochre)_30%,var(--border))]";
const HOVER =
  "hover:bg-[color-mix(in_oklch,var(--ochre)_14%,var(--paper))] hover:border-[color-mix(in_oklch,var(--ochre)_45%,var(--border))]";
const ACTIVE =
  "bg-[var(--ochre)] text-[var(--paper)] border-[var(--ochre-deep)] hover:bg-[var(--ochre-deep)] hover:border-[var(--ochre-deep)]";

export function TagBadge({
  name,
  size = "md",
  active,
  onClick,
  onRemove,
  className,
  asChild,
}: TagBadgeProps) {
  const badge = (
    <Badge
      variant="secondary"
      asChild={asChild}
      className={cn(
        BASE,
        size === "sm" ? "px-2 py-0 text-xs h-5 max-w-32" : "px-2.5 py-0.5 text-sm h-6",
        onClick && `cursor-pointer ${HOVER}`,
        active && ACTIVE,
        className,
      )}
      onClick={
        onClick
          ? (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
    >
      <span className="inline-flex items-center gap-1">
        <span className="truncate">{name}</span>
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className="ml-0.5 rounded-full p-0.5 -mr-1 shrink-0 transition-colors hover:bg-[color-mix(in_oklch,var(--ochre)_25%,transparent)]"
            aria-label={`Remove ${name} tag`}
          >
            <X className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
          </button>
        )}
      </span>
    </Badge>
  );

  if (onClick) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          {active ? "Remove from tag filter" : "Add to tag filter"}
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
