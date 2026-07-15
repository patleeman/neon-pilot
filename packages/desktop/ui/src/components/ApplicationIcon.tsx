import { cx } from './ui';

const ICON_PATHS: Record<string, string[]> = {
  app: ['M4.5 4.5h6v6h-6z', 'M13.5 4.5h6v6h-6z', 'M4.5 13.5h6v6h-6z', 'M13.5 13.5h6v6h-6z'],
  automation: ['M12 3.5 4 7.75 12 12l8-4.25z', 'M4 12.25 12 16.5l8-4.25', 'M4 16.75 12 21l8-4.25'],
  browser: ['M4 5.25h16v13.5H4z', 'M4 9h16', 'M7 7.1h.01', 'M9.5 7.1h.01'],
  database: [
    'M5 6c0-1.4 3.1-2.5 7-2.5s7 1.1 7 2.5-3.1 2.5-7 2.5S5 7.4 5 6z',
    'M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6',
    'M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6',
  ],
  diff: ['M7 4v16', 'm4 7 3-3 3 3', 'M17 20V4', 'm14 17 3 3 3-3'],
  file: ['M6.5 3.75h8l3 3v13.5h-11z', 'M14.5 3.75v3h3', 'M9 11h6', 'M9 14.5h6'],
  home: ['M3.75 10.25 12 3.75l8.25 6.5', 'M5.75 9v10.25h12.5V9', 'M9.25 19.25v-6.5h5.5v6.5'],
  sparkle: [
    'M12 3.25 13.3 8a3.5 3.5 0 0 0 2.45 2.45L20.5 11.75l-4.75 1.3a3.5 3.5 0 0 0-2.45 2.45L12 20.25l-1.3-4.75a3.5 3.5 0 0 0-2.45-2.45L3.5 11.75l4.75-1.3A3.5 3.5 0 0 0 10.7 8z',
  ],
  gear: [
    'M9.75 3.75h4.5l.55 2.05 1.75 1 2-.6 2.25 3.9-1.45 1.45v2l1.45 1.45-2.25 3.9-2-.6-1.75 1-.55 2.05h-4.5l-.55-2.05-1.75-1-2 .6-2.25-3.9 1.45-1.45v-2L3.2 10.1l2.25-3.9 2 .6 1.75-1z',
    'M9.25 12a2.75 2.75 0 1 0 5.5 0 2.75 2.75 0 0 0-5.5 0z',
  ],
  graph: ['M5 18.5V13', 'M12 18.5V8.5', 'M19 18.5V4.5', 'M3.5 18.5h17'],
  kanban: ['M4 4.5h5.5v15H4z', 'M14.5 4.5H20v9h-5.5z'],
  model: ['M12 3.5 19.5 7.75 12 12 4.5 7.75z', 'M4.5 7.75V16.25L12 20.5l7.5-4.25V7.75', 'M12 12v8.5'],
  play: ['M7.5 4.5v15l11-7.5z'],
  terminal: ['m5 7 4.5 5L5 17', 'M11.5 17H19'],
};

export function ApplicationIcon({ icon, title, className }: { icon?: string; title: string; className?: string }) {
  const paths = ICON_PATHS[icon ?? ''];
  return (
    <span className={cx('ui-application-icon', className)} aria-hidden="true">
      {paths ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
          {paths.map((path) => (
            <path key={path} d={path} />
          ))}
        </svg>
      ) : (
        <span>{title.trim().slice(0, 1).toUpperCase() || 'A'}</span>
      )}
    </span>
  );
}

export function PaletteItemIcon({ section, icon }: { section: string; icon?: string }) {
  const paths =
    ICON_PATHS[icon ?? ''] ??
    (section === 'pages'
      ? ['M6.5 3.75h8l3 3v13.5h-11z', 'M14.5 3.75v3h3', 'M9 11h6', 'M9 14.5h6']
      : section === 'commands'
        ? ['m13.25 2.75-7 10h5l-.75 8.5 7.25-11h-5z']
        : section === 'open' || section === 'archived'
          ? ['M4.5 5.5h15v10h-8l-4.5 4v-4H4.5z']
          : ['M5 5h14v14H5z']);
  return (
    <span className="ui-palette-item-icon" data-icon={icon || section} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
        {paths.map((path) => (
          <path key={path} d={path} />
        ))}
      </svg>
    </span>
  );
}
