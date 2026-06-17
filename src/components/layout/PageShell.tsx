interface Props {
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
}

export default function PageShell({ title, subtitle, headerRight, children, noPadding }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
          {headerRight && <div style={{ flexShrink: 0, marginTop: 4 }}>{headerRight}</div>}
        </div>
      </header>
      <div style={{ flex: 1, padding: noPadding ? 0 : '12px 0' }}>
        {children}
      </div>
    </div>
  );
}
