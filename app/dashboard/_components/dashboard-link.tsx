"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useId, useState, type ComponentProps } from "react";
import { useDashboard } from "./dashboard-provider";

function DashboardLinkStatus() {
  const { pending } = useLinkStatus();
  const { setLinkPending } = useDashboard();
  const id = useId();

  useEffect(() => {
    if (!pending) return;
    setLinkPending(id, true);
    return () => setLinkPending(id, false);
  }, [id, pending, setLinkPending]);

  return null;
}

export function DashboardLink({
  children,
  ...props
}: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      prefetch={intent ? true : "auto"}
      onMouseEnter={() => setIntent(true)}
      onFocus={() => setIntent(true)}
      onTouchStart={() => setIntent(true)}
    >
      {children}
      <DashboardLinkStatus />
    </Link>
  );
}
