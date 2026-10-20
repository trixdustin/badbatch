"use client";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-12" role="alert">
      <p className="text-sm text-neutral-600">admin / unavailable</p>
      <h1 className="mt-3 text-2xl">This admin page could not be loaded.</h1>
      <p className="mt-2 text-sm text-neutral-600">Please try again. If the problem continues, check the server configuration.</p>
      <button className="mt-6 min-h-11 bg-neutral-900 px-5 text-sm text-white" onClick={reset} type="button">
        try again
      </button>
    </section>
  );
}
