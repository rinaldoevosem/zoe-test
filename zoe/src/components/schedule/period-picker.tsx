import Link from "next/link";
import { cn } from "@/lib/utils";

export function PeriodPicker({ periods, current }: { periods: { id: string; name: string; status: string }[]; current: string }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
      {periods.map((p) => (
        <Link
          key={p.id}
          href={`/schedule?period=${p.id}`}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
            p.id === current && "bg-background text-foreground shadow-sm",
          )}
        >
          {p.name}
          <span className={cn("size-1.5 rounded-full", p.status === "published" ? "bg-success" : "bg-warning")} title={p.status} />
        </Link>
      ))}
    </div>
  );
}
