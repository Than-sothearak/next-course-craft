import { Suspense } from "react";
import {
  ArrowRight,
  BookOpen,
  Github,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LoginSkeleton } from "./login-skeleton";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default function LoginPage(props: LoginPageProps) {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginPageContent {...props} />
    </Suspense>
  );
}

async function LoginPageContent({ searchParams }: LoginPageProps) {
  const { callbackUrl } = await searchParams;
  const redirectTo = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  await connection();
  const session = await auth();
  if (session?.user) redirect(redirectTo);

  async function signInWithGitHub() {
    "use server";
    await signIn("github", { redirectTo });
  }

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo });
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div
          className="absolute -right-32 -top-28 h-[30rem] w-[30rem] rounded-full bg-indigo-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-40 -left-24 h-[30rem] w-[30rem] rounded-full bg-cyan-400/10 blur-3xl"
          aria-hidden="true"
        />
        <Link
          href="/"
          className="relative inline-flex w-fit items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-indigo-500">
            <Layers3 size={21} aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Coursecraft
          </span>
        </Link>

        <div className="relative max-w-xl pb-10">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
            A calmer way to create learning
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Turn what you know into courses people love.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
            Build clear, engaging learning experiences from one focused
            workspace.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
              <BookOpen
                className="mb-5 text-indigo-300"
                size={22}
                aria-hidden="true"
              />
              <p className="font-medium">Keep ideas organized</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Shape lessons into a course that flows.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
              <ShieldCheck
                className="mb-5 text-cyan-300"
                size={22}
                aria-hidden="true"
              />
              <p className="font-medium">Your work stays yours</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Sign in securely with Google or GitHub.
              </p>
            </div>
          </div>
        </div>
        <p className="relative text-sm text-slate-500">
          Thoughtful learning starts with a good first draft.
        </p>
      </section>

      <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-14">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 rounded-lg font-semibold tracking-tight text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 lg:hidden"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white">
            <Layers3 size={19} aria-hidden="true" />
          </span>
          Coursecraft
        </Link>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <div className="mb-8 grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
            <Layers3 size={24} aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-indigo-700">
            Welcome to Coursecraft
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Sign in to your workspace
          </h2>
          <p className="mt-3 leading-7 text-slate-600">
            Use your Google or GitHub account to continue creating your
            courses.
          </p>

          <form action={signInWithGoogle} className="mt-9">
            <Button
              type="submit"
              className="group min-h-13 w-full justify-center rounded-xl bg-slate-950 px-5 py-3.5 font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.99]"
            >
              <GoogleIcon />
              Continue with Google
              <ArrowRight
                size={17}
                className="ml-auto text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white"
                aria-hidden="true"
              />
            </Button>
          </form>

          <form action={signInWithGitHub} className="mt-3">
            <Button
              type="submit"
              variant="outline"
              className="group min-h-13 w-full justify-center rounded-xl px-5 py-3.5 font-medium active:scale-[0.99]"
            >
              <Github size={19} aria-hidden="true" />
              Continue with GitHub
              <ArrowRight
                size={17}
                className="ml-auto text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700"
                aria-hidden="true"
              />
            </Button>
          </form>

          <p className="mt-5 text-center text-sm leading-6 text-slate-500">
            You’ll be redirected to your chosen provider to authorize sign-in.
          </p>
          <div className="my-8 flex items-center gap-4" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Secure access
            </span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <ShieldCheck
              className="mt-0.5 shrink-0 text-emerald-600"
              size={19}
              aria-hidden="true"
            />
            <p>
              Your password is handled by your provider. Coursecraft never sees or
              stores it.
            </p>
          </div>
        </div>

        <footer className="mx-auto w-full max-w-md pb-2 text-center text-xs leading-5 text-slate-400">
          By signing in, you agree to use Coursecraft responsibly. Contact your
          workspace administrator for account access.
        </footer>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[19px]"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.38 3.61v2.79h3.85c2.25-2.08 3.58-5.15 3.58-8.43Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.92l-3.85-2.79c-1.07.72-2.44 1.15-4.1 1.15-3.15 0-5.82-2.13-6.78-5H1.24v2.87A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.22 14.44a7.2 7.2 0 0 1 0-4.88V6.69H1.24a12 12 0 0 0 0 10.62l3.98-2.87Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.82l3.45-3.45A11.53 11.53 0 0 0 12 0 12 12 0 0 0 1.24 6.69l3.98 2.87c.96-2.87 3.63-4.81 6.78-4.81Z"
      />
    </svg>
  );
}
