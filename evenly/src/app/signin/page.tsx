import Image from "next/image";
import { Suspense } from "react";
import { connection } from "next/server";
import { signInAs } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { listSignInOrganizations, listSignInUsers } from "@/server/session";

export const metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Image src="/icon.svg" alt="" loading="eager" width={32} height={32} />
            <span className="text-xl font-semibold">Evenly</span>
          </div>
          <CardTitle>Sign in to the demo</CardTitle>
          <CardDescription>
            Pick anyone to explore Evenly as them. Production sign-in uses your hospital&apos;s SSO and keeps you signed in on your phone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Preparing demo data…</p>}>
            <UserList searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function UserList({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  await connection();
  const orgs = await listSignInOrganizations();
  const requested = (await searchParams).org;
  const org = orgs.length === 1 ? orgs[0] : orgs.find((o) => o.id === requested);
  if (!org) {
    return (
      <ul className="flex flex-col divide-y rounded-md border">
        {orgs.map((o) => (
          <li key={o.id}><Link href={`/signin?org=${o.id}`} className="block px-4 py-3 text-sm font-medium hover:bg-accent">{o.name}</Link></li>
        ))}
      </ul>
    );
  }
  const users = await listSignInUsers(org.id);
  return (
    <section className="grid max-h-[60dvh] gap-2 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{org.name}</h2>
        {orgs.length > 1 && <Link href="/signin" className="text-xs text-primary hover:underline">Change organization</Link>}
      </div>
      <ul className="flex flex-col divide-y rounded-md border">
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
    </section>
  );
}
