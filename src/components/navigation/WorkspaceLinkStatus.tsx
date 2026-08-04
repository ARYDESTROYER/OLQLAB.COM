"use client";

import { useLinkStatus } from "next/link";

export default function WorkspaceLinkStatus({ label }: { label: string }) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span
        aria-hidden="true"
        className="workspace-link-status"
        data-pending={pending ? "true" : "false"}
      />
      {pending ? (
        <span className="sr-only" role="status">
          Loading {label}
        </span>
      ) : null}
    </>
  );
}
