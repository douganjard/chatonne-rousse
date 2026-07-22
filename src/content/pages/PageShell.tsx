import type { ReactNode } from 'react';

type PageShellProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

export function PageShell({ children, eyebrow, title }: PageShellProps) {
  return (
    <main className="content-page">
      <section className="content-inner">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <div className="content-copy">{children}</div>
      </section>
    </main>
  );
}
