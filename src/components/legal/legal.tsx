/** Shared building blocks for the long-form legal pages (privacy policy, terms). */

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="container max-w-3xl space-y-10 py-8">
      <header className="space-y-2">
        <h1 className="section-title font-display text-3xl font-black text-white">{title}</h1>
        <p className="text-sm text-lunex-gray">آخر تحديث: {updated}</p>
      </header>
      {children}
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="section-title font-display text-xl font-bold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-lunex-gray">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 ps-5 marker:text-primary-400">{children}</ul>;
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-white">{children}</span>;
}
