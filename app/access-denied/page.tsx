import Link from "next/link";
import { ShieldX } from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signOutAction } from "@/app/dashboard/actions";

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5">
      <Card className="max-w-lg p-10 text-center">
        <ShieldX className="mx-auto mb-5 text-indigo-600" size={40} />
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="mt-4 leading-7 text-slate-600">
          Your account does not have permission to access this resource. Contact
          an administrator if you need additional access.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Link
            href="/account-status"
            className={buttonVariants({ variant: "outline" })}
          >
            Account status
          </Link>
          <Link href="/dashboard" className={buttonVariants()}>
            Workspace
          </Link>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost">
              Sign out
            </Button>
          </form>
        </div>
      </Card>
    </main>
  );
}
