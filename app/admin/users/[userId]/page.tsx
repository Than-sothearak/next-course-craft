import { AdminSection } from "@/app/admin/_components/admin-section";
export default function Page({ params }: { params: Promise<{ userId: string }> }) { return <AdminSection section="users" params={params} />; }
