"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

/** Jump straight to any month — no tapping through months one by one. */
export function MonthJump({ value }: { value: string }) {
  const router = useRouter();
  return (
    <Input
      type="month"
      aria-label="Jump to month"
      className="w-44"
      defaultValue={value}
      onChange={(e) => e.target.value && router.push(`/me?month=${e.target.value}`)}
    />
  );
}
