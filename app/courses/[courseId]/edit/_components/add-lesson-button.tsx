"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AddLessonButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function addLesson() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/courses/${courseId}/lessons`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not add lesson.");
      router.push(`/courses/${courseId}/edit/lessons/${result.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add lesson.");
      setPending(false);
    }
  }
  return <div className="flex flex-col items-end gap-2">{error && <p role="alert" className="text-xs text-rose-700">{error}</p>}<Button onClick={addLesson} disabled={pending}>{pending ? <LoaderCircle className="animate-spin" size={16} /> : <FilePlus2 size={16} />}Add lesson</Button></div>;
}
