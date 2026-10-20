export function SectionLabel({
  index,
  children,
}: {
  index: string;
  children: string;
}) {
  return (
    <p className="micro-label">
      <span className="mr-3 text-[var(--cream-muted)]">{index}</span>
      {children}
    </p>
  );
}
