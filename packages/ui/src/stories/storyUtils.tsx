import type { CSSProperties, ReactNode } from 'react';

export function StoryStack({ children, width = 760 }: { children: ReactNode; width?: CSSProperties['width'] }) {
  return <div style={{ display: 'grid', gap: 24, width }}>{children}</div>;
}

export function StorySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
      {children}
    </section>
  );
}

export function Wrap({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>{children}</div>;
}
