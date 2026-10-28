"use client";

import { useState } from "react";
import { getGcashConfiguration } from "@/lib/payments/configuration";

const gcash = getGcashConfiguration();

export function GcashDetails() {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(gcash.accountNumber);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  return (
    <dl className="grid gap-3 border-y border-[var(--rule)] py-4 text-sm sm:grid-cols-2">
      <div><dt className="micro-label">GCash account name</dt><dd className="mt-1">{gcash.accountName}</dd></div>
      <div>
        <dt className="micro-label">GCash number</dt>
        <dd className="mt-1 flex flex-wrap items-center gap-3">
          <span className="font-mono text-base tracking-wide" id="gcash-number">{gcash.accountNumber}</span>
          <button aria-live="polite" className="min-h-10 border border-[var(--rule)] px-3 text-xs underline underline-offset-4 hover:border-[var(--cream-muted)]" onClick={copyNumber} type="button">{copied ? "copied" : "copy number"}</button>
        </dd>
        <span aria-live="polite" className="sr-only">{copied ? "GCash number copied." : copyFailed ? "Could not copy the number. Select and copy it manually." : ""}</span>
        {copyFailed ? <span className="text-xs text-[var(--cream-muted)]">Select and copy the number manually.</span> : null}
      </div>
    </dl>
  );
}
