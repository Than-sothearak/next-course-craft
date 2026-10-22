import { AdminSection } from "@/app/admin/_components/admin-section";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AdminSection section="courses" searchParams={searchParams} />;
}
