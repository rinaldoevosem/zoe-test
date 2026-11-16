"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/app/actions";

/** Runs a Server Action and reports the outcome as a toast, including Rule Violations when refused. */
export function useAction() {
  const [pending, start] = useTransition();
  function run<T>(fn: () => Promise<ActionResult<T>>, onOk?: (data: T | undefined) => void) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (res.message) toast.success(res.message);
        onOk?.(res.data);
      } else {
        toast.error(res.error, {
          description: res.violations?.length ? res.violations.map((v) => `• ${v.message}`).join("\n") : undefined,
          duration: 8000,
        });
      }
    });
  }
  return { pending, run };
}
