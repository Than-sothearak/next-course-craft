"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function dateLabel(value?: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}
export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={status === "active" || status === "published" ? "success" : status === "pending" || status === "draft" ? "default" : "secondary"}>{status.replaceAll("_", " ")}</Badge>;
}
export function UserAvatar({ name, image }: { name: string; image?: string | null }) {
  return <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-indigo-100 font-semibold text-indigo-700">{image ? <Image src={image} alt="" width={40} height={40} unoptimized className="size-10 object-cover" /> : name.slice(0, 1).toUpperCase()}</span>;
}
export function Notice({ notice }: { notice: { error: boolean; message: string } | null }) {
  return notice ? <p role={notice.error ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${notice.error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{notice.message}</p> : null;
}
export function Pagination({ page, pageSize, total, onPage, disabled = false }: { page: number; pageSize: number; total: number; onPage: (page: number) => void; disabled?: boolean }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><p className="text-sm text-slate-500">{total} results · Page {page} of {pages}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={disabled || page >= pages} onClick={() => onPage(page + 1)}>Next</Button></div></div>;
}
