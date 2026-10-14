import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import { getDashboardData } from "@/lib/dashboard/services/list";
import DashboardClient from "./dashboard-client";

type SearchParams = Promise<{
  folderId?: string;
  q?: string;
  status?: string;
  sort?: string;
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fdashboard");

  const params = await searchParams;
  const status =
    params.status === "draft" ||
    params.status === "published" ||
    params.status === "archived"
      ? params.status
      : "all";
  const sort =
    params.sort === "title" || params.sort === "created"
      ? params.sort
      : "updated";
  let data = {
    currentFolder: null,
    breadcrumbs: [{ id: null, name: "All courses" }],
    folders: [],
    courses: [],
    folderOptions: [],
    folderTree: [],
  } as Awaited<ReturnType<typeof getDashboardData>>;
  let loadError: string | null = null;

  try {
    if (!process.env.MONGODB_URI)
      throw new DashboardError(
        "Add MONGODB_URI to .env.local to enable course storage.",
        503,
      );
    await connectToDatabase();
    data = await getDashboardData(session.user.id, {
      folderId: params.folderId ?? null,
      q: params.q ?? "",
      status,
      sort,
    });
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Course storage is unavailable.";
  }

  return (
    <DashboardClient
      initialData={data}
      initialFolderId={params.folderId ?? null}
      initialQuery={params.q ?? ""}
      initialStatus={status}
      initialSort={sort}
      initialError={loadError}
      userName={session.user.name ?? session.user.email ?? "Author"}
    />
  );
}
