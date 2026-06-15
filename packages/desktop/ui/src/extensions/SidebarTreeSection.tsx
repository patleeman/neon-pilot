import type { CSSProperties, ReactNode } from 'react';

import { type ActivityTreeViewProps, ActivityTreeView } from '../activity/ActivityTreeView';
import { cx, SidebarSection } from '../components/ui';

export interface SidebarTreeSectionProps extends Omit<ActivityTreeViewProps, 'className' | 'style'> {
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  titleClassName?: string;
  treeClassName?: string;
  treeStyle?: CSSProperties;
}

export function SidebarTreeSection({
  title,
  actions,
  className,
  headerClassName,
  bodyClassName,
  titleClassName,
  treeClassName,
  treeStyle,
  ...treeProps
}: SidebarTreeSectionProps) {
  return (
    <SidebarSection
      title={title}
      actions={actions}
      className={cx('h-full min-h-0', className)}
      headerClassName={headerClassName}
      bodyClassName={bodyClassName}
      titleClassName={titleClassName}
    >
      <ActivityTreeView {...treeProps} className={treeClassName} style={treeStyle} />
    </SidebarSection>
  );
}
