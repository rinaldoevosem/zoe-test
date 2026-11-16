import Image from "next/image";
import { Suspense } from "react";
import { connection } from "next/server";
import { signInAs } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb, schema } from "@/server/db";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Image src="/icon.svg" alt="" loading="eager" width={32} height={32} />
            <span className="text-xl font-semibold">Zoe</span>
          </div>
          <CardTitle>Sign in to the demo</CardTitle>
          <CardDescription>
            Pick anyone to explore Zoe as them. Production sign-in uses your hospital&apos;s SSO and keeps you signed in on your phone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Preparing demo data…</p>}>
            <UserList />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function UserList() {
  await connection();
  const db = await getDb();
  const users = await db.select().from(schema.users);
  const order = { scheduler: 0, admin: 1, staff: 2 } as const;
  users.sort((a, b) => order[a.permission] - order[b.permission] || a.name.localeCompare(b.name));
  return (
    <ul className="flex max-h-[60dvh] flex-col divide-y overflow-auto rounded-md border">
      {users.map((u) => (
        <li key={u.id}>
          <form action={signInAs.bind(null, u.id)}>
            <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-accent" data-testid={`signin-${u.permission}`}>
              <span className="font-medium">{u.name}</span>
              <Badge variant={u.permission === "staff" ? "secondary" : "default"} className="capitalize">
                {u.permission === "admin" ? "admin + staff" : u.permission}
              </Badge>
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
