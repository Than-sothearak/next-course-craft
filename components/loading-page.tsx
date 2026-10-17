import { Layers3 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { DashboardNavbar } from "@/app/dashboard/_components/dashboard-navbar";

type LoadingPageProps = {
  message?: string;
};

export function LoadingPage({ message = "Loading page…" }: LoadingPageProps) {
  return (
    <div className="min-h-svh bg-slate-50">
      <DashboardNavbar profile={null} hideAccount />
      <main className="grid min-h-[calc(100svh-4rem)] place-items-center px-6 py-12">
        <div role="status" aria-atomic="true" className="flex flex-col items-center text-center">
          <div aria-hidden="true" className="relative mb-6 grid size-20 place-items-center">
            <Spinner
              aria-hidden="true"
              className="absolute inset-0 size-20 text-indigo-500 [animation-duration:1.5s]"
              strokeWidth={1.25}
            />
            <span className="grid size-12 place-items-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/70">
              <Layers3 size={23} />
            </span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Coursecraft
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
        </div>
      </main>
    </div>
  );
}
