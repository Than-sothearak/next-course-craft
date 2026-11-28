"use client";

import { createContext, useContext, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { popupFadeDuration } from "./popup-motion";
import { cn } from "@/lib/utils";
import { PopupAncestorsContext } from "./popup-context";
import "./modal-motion.css";

const ModalOpenContext = createContext(true);

export function useModalOpen(open = true) {
  return useContext(ModalOpenContext) && open;
}

/** Retain a closing surface until its shared fade finishes; reopening cancels removal. */
export function useModalPresence(open: boolean) {
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  const reduced = typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (open || !present) return;
    const timer = window.setTimeout(() => setPresent(false), reduced ? 0 : popupFadeDuration);
    return () => window.clearTimeout(timer);
  }, [open, present, reduced]);
  return reduced ? open : present;
}

/** Keep conditional feature components/portals mounted while their modal exits. */
export function ModalPresence({ children }: { children: ReactNode }) {
  const active = children !== null && children !== undefined && children !== false;
  const [retained, setRetained] = useState(children);
  if (active && retained !== children) setRetained(children);
  const open = useModalOpen(active);
  const present = useModalPresence(active);
  return present ? <ModalOpenContext.Provider value={open}>{active ? children : retained}</ModalOpenContext.Provider> : null;
}

/** Shared motion for existing custom modal layouts; no hover-based dismissal. */
export function ModalOverlay({ children, className, animated = true, ...props }: ComponentProps<"div"> & { animated?: boolean }) {
  const open = useModalOpen();
  const popupAncestors = useContext(PopupAncestorsContext);
  return <div {...props} data-popup-ancestors={popupAncestors.join(" ") || undefined} data-modal-overlay={animated || undefined} data-state={open ? "open" : "closed"} aria-hidden={!open || undefined} inert={!open} className={cn(animated && "ui-modal-overlay", className)}>{children}</div>;
}

export function ModalPanel({ children, className, ...props }: ComponentProps<"section">) {
  const open = useModalOpen();
  return <section role="dialog" aria-modal="true" {...props} data-modal-panel data-state={open ? "open" : "closed"} className={cn("ui-modal-panel", className)}>{children}</section>;
}
