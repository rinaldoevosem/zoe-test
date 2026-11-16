import { redirect } from "next/navigation";
import { can } from "@/domain/permissions";
import { requireSession } from "@/server/session";

export default async function Home() {
  const actor = await requireSession();
  redirect(can(actor, "schedule:edit") && !actor.staffMemberId ? "/schedule" : "/me");
}

// Reads the session and the clock on every request (ADR-0008).
export const instant = false;
