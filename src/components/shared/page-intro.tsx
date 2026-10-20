export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-neutral-300 pb-6">
      <p className="mb-2 text-sm uppercase tracking-widest text-neutral-500">{eyebrow}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {children ? <div className="mt-3 max-w-2xl text-neutral-600">{children}</div> : null}
    </header>
  );
}
