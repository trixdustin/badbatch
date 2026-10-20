"use client";

export function PrintReceiptButton() {
  return (
    <button
      className="min-h-11 bg-neutral-900 px-5 text-sm text-white"
      onClick={() => window.print()}
      type="button"
    >
      print receipt
    </button>
  );
}
