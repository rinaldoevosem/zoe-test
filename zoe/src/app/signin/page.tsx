import Image from "next/image";
import { Suspense } from "react";
import { connection } from "next/server";
import { signInAs } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listSignInChoices } from "@/server/session";

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
  const groups = await listSignInChoices();
  return (
    <div className="flex max-h-[60dvh] flex-col gap-4 overflow-auto">
      {groups.map((g) => (
        <section key={g.organization} className="grid gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.organization}</h2>
          <ul className="flex flex-col divide-y rounded-md border">
            {g.users.map((u) => (
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
        </section>
      ))}
    </div>
  );
}
