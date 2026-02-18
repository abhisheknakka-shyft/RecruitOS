import { cn } from "@/lib/utils";

export function DotScale({ rating, className }: { rating: number; className?: string }) {
  return (
    <div className={cn("flex gap-1", className)}>
      {[...Array(5)].map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 w-2 rounded-full",
            i < rating ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}
