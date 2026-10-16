import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardFilters, DashboardListing } from "@/lib/dashboard/types";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), connect: vi.fn(), listing: vi.fn(), navigation: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/mongodb", () => ({ connectToDatabase: mocks.connect }));
vi.mock("@/lib/dashboard/services/list", () => ({ getDashboardListing: mocks.listing, getDashboardNavigation: mocks.navigation }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`Redirect: ${url}`); } }));

import { loadDashboardListing, loadDashboardNavigation } from "@/app/dashboard/_components/dashboard-data";

const filters: DashboardFilters = { workspaceId: null, folderId: null, q: "", status: "all", sort: "updated" };
const listing: DashboardListing = { currentFolder: null, breadcrumbs: [], folders: [], courses: [] };
const navigation = { folderTree: [], folderOptions: [], workspaces: [], workspaceId: null, workspaceName: "Personal", workspaceRole: "owner" as const };

describe("dashboard server sections", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("MONGODB_URI", "mongodb://test/coursecraft");
    mocks.auth.mockResolvedValue({ user: { id: "owner-1", name: "Author" } });
    mocks.connect.mockResolvedValue(undefined);
    mocks.listing.mockResolvedValue(listing);
    mocks.navigation.mockResolvedValue(navigation);
  });

  it("requires authentication before either section accesses storage", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(loadDashboardNavigation(null)).rejects.toThrow("Redirect: /login?callbackUrl=%2Fdashboard");
    await expect(loadDashboardListing(filters)).rejects.toThrow("Redirect:");
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.navigation).not.toHaveBeenCalled();
    expect(mocks.listing).not.toHaveBeenCalled();
  });

  it("resolves owner-scoped folder navigation while the course listing is still pending", async () => {
    let resolveListing!: (value: DashboardListing) => void;
    mocks.listing.mockReturnValue(new Promise<DashboardListing>((resolve) => { resolveListing = resolve; }));
    const content = loadDashboardListing(filters);
    let contentReady = false;
    void content.then(() => { contentReady = true; });

    expect(await loadDashboardNavigation(null)).toEqual({ data: navigation, error: null });
    expect(contentReady).toBe(false);
    expect(mocks.navigation).toHaveBeenCalledWith("owner-1", null);
    expect(mocks.listing).toHaveBeenCalledWith("owner-1", filters);
    resolveListing(listing);
    expect(await content).toEqual({ data: listing, error: null });
  });

  it("keeps a listing failure separate from successful navigation", async () => {
    mocks.listing.mockRejectedValue(new Error("Course storage is unavailable."));
    expect(await loadDashboardNavigation(null)).toEqual({ data: navigation, error: null });
    expect(await loadDashboardListing(filters)).toMatchObject({ error: "Course storage is unavailable.", data: { folders: [], courses: [] } });
  });
});
