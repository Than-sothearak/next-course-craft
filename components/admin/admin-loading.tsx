import { Skeleton } from "@/components/ui/skeleton";

export function AdminLoading() {
  return <div role="status" aria-label="Loading administration" className="space-y-6 p-6"><Skeleton className="h-9 w-64" /><div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div><Skeleton className="h-80 w-full rounded-xl" /></div>;
}
