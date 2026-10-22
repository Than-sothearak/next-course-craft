"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

type AdminPrefetchLinkProps = Omit<ComponentProps<typeof Link>, "prefetch">;

export function AdminPrefetchLink({ onMouseEnter, onFocus, onTouchStart, ...props }: AdminPrefetchLinkProps) {
  const [intent, setIntent] = useState(false);
  return <Link
    {...props}
    prefetch={intent}
    onMouseEnter={(event) => { onMouseEnter?.(event); setIntent(true); }}
    onFocus={(event) => { onFocus?.(event); setIntent(true); }}
    onTouchStart={(event) => { onTouchStart?.(event); setIntent(true); }}
  />;
}
