"use client";

import { useContext, useEffect, useState } from "react";
import { AdminResourceContext } from "./admin-resource-provider";

export function useAdminResource<T>(url: string) {
  const context = useContext(AdminResourceContext);
  const seed = context?.initialResource;
  const initialData = seed?.url === url ? seed.data as T : null;
  const [revision, setRevision] = useState(0);
  const key = `${url}|${revision}`;
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>(() => ({ key: initialData === null ? "" : key, data: initialData, error: null }));
  useEffect(() => {
    const controller = new AbortController();
    if (revision === 0 && initialData !== null) {
      Promise.resolve().then(() => {
        if (!controller.signal.aborted) setState({ key, data: initialData, error: null });
      });
      return () => controller.abort();
    }
    fetch(url, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load this page.");
      return body as T;
    }).then((data) => { if (!controller.signal.aborted) setState({ key, data, error: null }); }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ key, data: null, error: error instanceof Error ? error.message : "Could not load this page." });
    });
    return () => controller.abort();
  }, [url, key, revision, initialData]);
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : null, loading: state.key !== key, reload: () => {
    context?.refresh();
    setRevision((value) => value + 1);
  } };
}

export function useAdminMutation(onSuccess: () => void) {
  const context = useContext(AdminResourceContext);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; message: string } | null>(null);
  async function mutate(url: string, method: string, body: unknown) {
    if (busy) return false;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(result?.error || "The change could not be saved.");
      context?.refresh();
      setNotice({ error: false, message: "Changes saved." });
      onSuccess();
      return true;
    } catch (error) {
      setNotice({ error: true, message: error instanceof Error ? error.message : "The change could not be saved." });
      return false;
    } finally { setBusy(false); }
  }
  return { busy, notice, mutate };
}
