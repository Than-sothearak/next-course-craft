import { Suspense } from "react";
import type { DashboardListing, DashboardNavigation } from "@/lib/dashboard/types";
import { dashboardFilters, dashboardQueryKey, type DashboardSearchParams } from "@/lib/dashboard/query";
import DashboardClient from "./dashboard-client";
import { DashboardNavbar, DashboardUserProfile } from "./_components/dashboard-navbar";
import { DashboardProvider } from "./_components/dashboard-provider";
import { DashboardNavigationClient } from "./_components/dashboard-navigation-client";
import { DashboardContentSkeleton, DashboardProfileSkeleton, DashboardSidebarSkeleton, DashboardWorkspaceSkeleton } from "./_components/dashboard-skeletons";
import { getDashboardUser, loadDashboardListing, loadDashboardNavigation, type DashboardLoadResult } from "./_components/dashboard-data";

type PageProps = { searchParams: Promise<DashboardSearchParams> };

export default function DashboardPage({ searchParams }: PageProps) {
  return <main className="flex min-h-screen flex-col bg-[#f7f8fc] text-slate-900">
    <DashboardNavbar profile={<Suspense fallback={<DashboardProfileSkeleton />}><DashboardProfile /></Suspense>} />
    <Suspense fallback={<DashboardWorkspaceSkeleton />}>
      <DashboardWorkspace searchParams={searchParams} />
    </Suspense>
  </main>;
}

async function DashboardWorkspace({ searchParams }: PageProps) {
  // URL-specific work stays behind Suspense so dashboard links can share the shell.
  const filters = dashboardFilters(await searchParams);
  const navigation = loadDashboardNavigation(filters.workspaceId);
  const listing = loadDashboardListing(filters);

  return <DashboardProvider key={dashboardQueryKey(filters)} initialFilters={filters}>
      <div className="grid flex-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Suspense fallback={<DashboardSidebarSkeleton />}>
          <DashboardNavigationSection navigation={navigation} />
        </Suspense>
        <Suspense fallback={<DashboardContentSkeleton />}>
          <DashboardListingSection navigation={navigation} listing={listing} />
        </Suspense>
      </div>
  </DashboardProvider>;
}

async function DashboardProfile() {
  const { userName, permissions } = await getDashboardUser();
  return <DashboardUserProfile userName={userName} permissions={permissions} />;
}

async function DashboardNavigationSection({ navigation }: { navigation: Promise<DashboardLoadResult<DashboardNavigation>> }) {
  const { data, error } = await navigation;
  return <DashboardNavigationClient initialNavigation={data} initialError={error} />;
}

async function DashboardListingSection({ navigation, listing }: {
  navigation: Promise<DashboardLoadResult<DashboardNavigation>>;
  listing: Promise<DashboardLoadResult<DashboardListing>>;
}) {
  const [user, navigationResult, listingResult] = await Promise.all([getDashboardUser(), navigation, listing]);
  return <DashboardClient initialData={{ ...listingResult.data, ...navigationResult.data }} initialError={listingResult.error ?? navigationResult.error} userName={user.userName} />;
}
