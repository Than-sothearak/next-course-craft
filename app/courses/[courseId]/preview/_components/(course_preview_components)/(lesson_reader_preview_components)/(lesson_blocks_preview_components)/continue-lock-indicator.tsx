"use client";

import { LockKeyhole, UnlockKeyhole } from "lucide-react";
export function ContinueLockIndicator({
  unlocking,
  onAnimationEnd,
}: {
  unlocking: boolean;
  onAnimationEnd: () => void;
}) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
      {unlocking ? (
        <>
          <LockKeyhole
            size={15}
            className="absolute lesson-lock-release"
            onAnimationEnd={onAnimationEnd}
          />
          <UnlockKeyhole size={15} className="absolute lesson-lock-open" />
        </>
      ) : (
        <LockKeyhole size={15} />
      )}
    </span>
  );
}
